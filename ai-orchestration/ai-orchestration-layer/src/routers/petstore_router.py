"""
Petstore Router - Connects to the portfolio Petstore Spring Boot backend

FIXED: .dict() → .model_dump() (Pydantic v2)
"""

import logging
from typing import List, Optional, Set
from datetime import date
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/petstore", tags=["Petstore"])

# Configuration
PETSTORE_BASE_URL = "http://petstore:8083/petstore"
REQUEST_TIMEOUT = 10.0


# =============================================================================
# Pydantic Models
# =============================================================================

class EmployeeCreate(BaseModel):
    name: str
    skills: List[str] = []
    daysAvailable: List[str] = []


class Employee(BaseModel):
    id: int
    name: str
    skills: List[str] = []
    daysAvailable: List[str] = []


class EmployeeAvailabilityRequest(BaseModel):
    daysAvailable: List[str]


class FindAvailableRequest(BaseModel):
    skills: List[str]
    date: str  # Format: YYYY-MM-DD


class CustomerCreate(BaseModel):
    name: str
    phoneNumber: str
    notes: Optional[str] = None
    petIds: Optional[List[int]] = None


class Customer(BaseModel):
    id: int
    name: str
    phoneNumber: str
    notes: Optional[str] = None
    petIds: Optional[List[int]] = []


class PetCreate(BaseModel):
    type: str
    name: str
    ownerId: int
    birthDate: Optional[str] = None
    notes: Optional[str] = None


class PetUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    ownerId: Optional[int] = None
    birthDate: Optional[str] = None
    notes: Optional[str] = None


class Pet(BaseModel):
    id: int
    type: str
    name: str
    ownerId: int
    birthDate: Optional[str] = None
    notes: Optional[str] = None


class ScheduleCreate(BaseModel):
    date: str
    employeeIds: List[int]
    petIds: List[int]
    activities: List[str]


class Schedule(BaseModel):
    id: int
    date: str
    employeeIds: List[int] = []
    petIds: List[int] = []
    activities: List[str] = []


# =============================================================================
# HTTP Client Helper
# =============================================================================

async def make_request(
    method: str,
    endpoint: str,
    json_data: dict = None,
    params: dict = None
) -> dict:
    """Make HTTP request to Petstore backend with error handling."""
    url = f"{PETSTORE_BASE_URL}{endpoint}"
    
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            if method.upper() == "GET":
                response = await client.get(url, params=params)
            elif method.upper() == "POST":
                response = await client.post(url, json=json_data)
            elif method.upper() == "PUT":
                response = await client.put(url, json=json_data)
            elif method.upper() == "DELETE":
                response = await client.delete(url)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            
            if response.status_code == 204 or not response.content:
                return {}
            
            return response.json()
            
        except httpx.ConnectError as e:
            logger.error(f"Petstore connection error: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Petstore service unavailable: {str(e)}"
            )
        except httpx.TimeoutException as e:
            logger.error(f"Petstore timeout: {e}")
            raise HTTPException(
                status_code=504,
                detail="Petstore service timeout"
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Petstore HTTP error: {e.response.status_code}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Petstore error: {e.response.text}"
            )


def transform_employee(data: dict) -> dict:
    """Transform Petstore employee response to our format."""
    return {
        "id": data.get("id", 0),
        "name": data.get("name", ""),
        "skills": list(data.get("skills", [])),
        "daysAvailable": list(data.get("daysAvailable", []))
    }


def transform_customer(data: dict) -> dict:
    """Transform Petstore customer response to our format."""
    return {
        "id": data.get("id", 0),
        "name": data.get("name", ""),
        "phoneNumber": data.get("phoneNumber", ""),
        "notes": data.get("notes"),
        "petIds": data.get("petIds", [])
    }


def transform_pet(data: dict) -> dict:
    """Transform Petstore pet response to our format."""
    return {
        "id": data.get("id", 0),
        "type": data.get("petType", data.get("type", "UNKNOWN")),
        "name": data.get("name", ""),
        "ownerId": data.get("customer", {}).get("id", 0) if isinstance(data.get("customer"), dict) else data.get("ownerId", 0),
        "birthDate": data.get("birthDate"),
        "notes": data.get("notes")
    }


def transform_schedule(data: dict) -> dict:
    """Transform Petstore schedule response to our format."""
    employee_ids = []
    if "employeeList" in data:
        employee_ids = [e.get("id") for e in data["employeeList"] if e.get("id")]
    elif "employeeIds" in data:
        employee_ids = data["employeeIds"]
    
    pet_ids = []
    if "petList" in data:
        pet_ids = [p.get("id") for p in data["petList"] if p.get("id")]
    elif "petIds" in data:
        pet_ids = data["petIds"]
    
    activities = list(data.get("employeeSkills", data.get("activities", [])))
    
    return {
        "id": data.get("id", 0),
        "date": str(data.get("date", "")),
        "employeeIds": employee_ids,
        "petIds": pet_ids,
        "activities": activities
    }


# =============================================================================
# Employee Endpoints
# =============================================================================

@router.get("/user/employee", response_model=dict)
async def get_all_employees():
    """Get all employees."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(f"{PETSTORE_BASE_URL}/user/employee")
            if response.status_code == 200:
                data = response.json()
                employees = [transform_employee(e) for e in (data if isinstance(data, list) else [])]
                return {"employees": employees, "total": len(employees)}
            else:
                return {"employees": [], "total": 0}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employees: {e}")
        return {"employees": [], "total": 0}


@router.get("/user/employee/{employee_id}", response_model=Employee)
async def get_employee_by_id(employee_id: int):
    """Get employee by ID."""
    data = await make_request("GET", f"/user/employee/{employee_id}")
    return Employee(**transform_employee(data))


@router.post("/user/employee", response_model=Employee)
async def create_employee(employee: EmployeeCreate):
    """Create a new employee."""
    payload = {
        "name": employee.name,
        "skills": employee.skills,
        "daysAvailable": employee.daysAvailable
    }
    data = await make_request("POST", "/user/employee", json_data=payload)
    return Employee(**transform_employee(data))


@router.put("/user/employee/{employee_id}/availability")
async def set_employee_availability(employee_id: int, request: EmployeeAvailabilityRequest):
    """Set employee's available days."""
    await make_request("PUT", f"/user/employee/{employee_id}", json_data={
        "daysAvailable": request.daysAvailable
    })
    return {"status": "success", "message": "Availability updated"}


@router.post("/user/employee/available", response_model=dict)
async def find_available_employees(request: FindAvailableRequest):
    """Find employees available on a specific date with required skills."""
    payload = {
        "skills": request.skills,
        "date": request.date
    }
    data = await make_request("POST", "/user/employee/availability", json_data=payload)
    employees = [transform_employee(e) for e in (data if isinstance(data, list) else [])]
    return {"employees": employees, "total": len(employees)}


@router.delete("/user/employee/{employee_id}")
async def delete_employee(employee_id: int):
    """Delete an employee."""
    await make_request("DELETE", f"/user/employee/{employee_id}")
    return {"status": "success", "message": "Employee deleted"}


# =============================================================================
# Customer Endpoints
# =============================================================================

@router.get("/user/customer", response_model=dict)
async def get_all_customers():
    """Get all customers."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(f"{PETSTORE_BASE_URL}/user/customer")
            if response.status_code == 200:
                data = response.json()
                customers = [transform_customer(c) for c in (data if isinstance(data, list) else [])]
                return {"customers": customers, "total": len(customers)}
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
    
    return {"customers": [], "total": 0}


@router.get("/user/customer/{customer_id}", response_model=Customer)
async def get_customer_by_id(customer_id: int):
    """Get customer by ID."""
    data = await make_request("GET", f"/user/customer/{customer_id}")
    return Customer(**transform_customer(data))


@router.post("/user/customer", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    """Create a new customer."""
    payload = {
        "name": customer.name,
        "phoneNumber": customer.phoneNumber,
        "notes": customer.notes,
        "petIds": customer.petIds or []
    }
    data = await make_request("POST", "/user/customer", json_data=payload)
    return Customer(**transform_customer(data))


@router.get("/user/customer/pet/{pet_id}", response_model=Customer)
async def get_customer_by_pet(pet_id: int):
    """Get customer who owns a specific pet."""
    data = await make_request("GET", f"/user/customer/pet/{pet_id}")
    return Customer(**transform_customer(data))


@router.delete("/user/customer/{customer_id}")
async def delete_customer(customer_id: int):
    """Delete a customer."""
    await make_request("DELETE", f"/user/customer/{customer_id}")
    return {"status": "success", "message": "Customer deleted"}


# =============================================================================
# Pet Endpoints
# =============================================================================

@router.get("/pet", response_model=dict)
async def get_all_pets():
    """Get all pets."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(f"{PETSTORE_BASE_URL}/pet")
            if response.status_code == 200:
                data = response.json()
                pets = [transform_pet(p) for p in (data if isinstance(data, list) else [])]
                return {"pets": pets, "total": len(pets)}
    except Exception as e:
        logger.error(f"Error fetching pets: {e}")
    
    return {"pets": [], "total": 0}


@router.get("/pet/{pet_id}", response_model=Pet)
async def get_pet_by_id(pet_id: int):
    """Get pet by ID."""
    data = await make_request("GET", f"/pet/{pet_id}")
    return Pet(**transform_pet(data))


@router.post("/pet", response_model=Pet)
async def create_pet(pet: PetCreate):
    """Create a new pet."""
    payload = {
        "type": pet.type,
        "name": pet.name,
        "ownerId": pet.ownerId,
        "birthDate": pet.birthDate,
        "notes": pet.notes
    }
    data = await make_request("POST", "/pet", json_data=payload)
    return Pet(**transform_pet(data))


@router.put("/pet/{pet_id}", response_model=Pet)
async def update_pet(pet_id: int, pet: PetUpdate):
    """Update an existing pet."""
    # FIXED: was pet.dict().items()
    payload = {k: v for k, v in pet.model_dump().items() if v is not None}
    payload["id"] = pet_id
    data = await make_request("PUT", f"/pet/{pet_id}", json_data=payload)
    return Pet(**transform_pet(data))


@router.get("/pet/owner/{owner_id}", response_model=dict)
async def get_pets_by_owner(owner_id: int):
    """Get all pets owned by a specific customer."""
    data = await make_request("GET", f"/pet/owner/{owner_id}")
    pets = [transform_pet(p) for p in (data if isinstance(data, list) else [])]
    return {"pets": pets, "total": len(pets)}


@router.delete("/pet/{pet_id}")
async def delete_pet(pet_id: int):
    """Delete a pet."""
    await make_request("DELETE", f"/pet/{pet_id}")
    return {"status": "success", "message": "Pet deleted"}


# =============================================================================
# Schedule Endpoints
# =============================================================================

@router.get("/schedule", response_model=dict)
async def get_all_schedules():
    """Get all schedules."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(f"{PETSTORE_BASE_URL}/schedule")
            if response.status_code == 200:
                data = response.json()
                schedules = [transform_schedule(s) for s in (data if isinstance(data, list) else [])]
                return {"schedules": schedules, "total": len(schedules)}
    except Exception as e:
        logger.error(f"Error fetching schedules: {e}")
    
    return {"schedules": [], "total": 0}


@router.post("/schedule", response_model=Schedule)
async def create_schedule(schedule: ScheduleCreate):
    """Create a new schedule."""
    payload = {
        "date": schedule.date,
        "employeeIds": schedule.employeeIds,
        "petIds": schedule.petIds,
        "activities": schedule.activities
    }
    data = await make_request("POST", "/schedule", json_data=payload)
    return Schedule(**transform_schedule(data))


@router.get("/schedule/employee/{employee_id}", response_model=dict)
async def get_employee_schedule(employee_id: int):
    """Get schedules for a specific employee."""
    data = await make_request("GET", f"/schedule/employee/{employee_id}")
    schedules = [transform_schedule(s) for s in (data if isinstance(data, list) else [])]
    return {"schedules": schedules, "total": len(schedules)}


@router.get("/schedule/pet/{pet_id}", response_model=dict)
async def get_pet_schedule(pet_id: int):
    """Get schedules for a specific pet."""
    data = await make_request("GET", f"/schedule/pet/{pet_id}")
    schedules = [transform_schedule(s) for s in (data if isinstance(data, list) else [])]
    return {"schedules": schedules, "total": len(schedules)}


@router.get("/schedule/customer/{customer_id}", response_model=dict)
async def get_customer_schedule(customer_id: int):
    """Get schedules for a specific customer's pets."""
    data = await make_request("GET", f"/schedule/customer/{customer_id}")
    schedules = [transform_schedule(s) for s in (data if isinstance(data, list) else [])]
    return {"schedules": schedules, "total": len(schedules)}


# =============================================================================
# Health Check
# =============================================================================

@router.get("/health")
async def health_check():
    """Check Petstore backend health."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{PETSTORE_BASE_URL}/actuator/health")
            if response.status_code == 200:
                return {"status": "healthy", "service": "petstore", "backend_status": response.json()}
    except Exception as e:
        logger.warning(f"Petstore health check failed: {e}")
    
    return {"status": "unhealthy", "service": "petstore", "error": "Backend unreachable"}
