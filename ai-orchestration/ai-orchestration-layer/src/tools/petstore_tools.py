# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/petstore_tools.py
# PETSTORE SERVICE TOOLS
# ============================================================================

from langchain_core.tools import tool
from typing import Dict, Any, List, Optional
import json
from .http_client import ServiceHTTPClients

try:
    from core.unified_logger import get_logger
    logger = get_logger()
except ImportError:
    import logging
    logger = logging.getLogger("petstore_tools")


# ============================================================================
# PET OPERATIONS
# ============================================================================

@tool
async def get_pet(pet_id: int) -> str:
    """
    Get pet details by ID.
    Args:
        pet_id: The ID of the pet to retrieve
    Returns: JSON string containing pet details
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/pet/{pet_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_pet_failed", {"pet_id": pet_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def add_pet(name: str, status: str = "available") -> str:
    """
    Add a new pet to the store.
    Args:
        name: Name of the pet
        status: Pet status (available, pending, sold) - default: available
    Returns: JSON string containing the created pet
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.post("/pet", json={
            "name": name,
            "status": status,
            "photoUrls": []
        })
        return json.dumps(response)
    except Exception as e:
        logger.error("add_pet_failed", {"name": name, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def update_pet(pet_id: int, name: str, status: str) -> str:
    """
    Update an existing pet.
    Args:
        pet_id: The ID of the pet to update
        name: New name for the pet
        status: New status (available, pending, sold)
    Returns: JSON string containing the updated pet
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.put("/pet", json={
            "id": pet_id,
            "name": name,
            "status": status
        })
        return json.dumps(response)
    except Exception as e:
        logger.error("update_pet_failed", {"pet_id": pet_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def find_pets_by_status(status: str) -> str:
    """
    Find pets by status.
    Args:
        status: Pet status to filter by (available, pending, sold)
    Returns: JSON string containing list of pets with the given status
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/pet/findByStatus", params={"status": status})
        return json.dumps(response)
    except Exception as e:
        logger.error("find_pets_failed", {"status": status, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_all_pets() -> str:
    """
    Get all pets from the petstore.
    Returns: JSON string containing all pets
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/pet")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_all_pets_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def create_pet(pet_type: str, name: str, owner_id: int, birth_date: str = None, notes: str = None) -> str:
    """
    Create a new pet with full details.
    Args:
        pet_type: Type of pet (e.g., DOG, CAT, BIRD)
        name: Name of the pet
        owner_id: ID of the customer who owns the pet
        birth_date: Birth date in YYYY-MM-DD format (optional)
        notes: Additional notes about the pet (optional)
    Returns: JSON string containing the created pet
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        pet_data = {
            "type": pet_type,
            "name": name,
            "ownerId": owner_id
        }
        if birth_date:
            pet_data["birthDate"] = birth_date
        if notes:
            pet_data["notes"] = notes
            
        response = await client.post("/pet", json=pet_data)
        return json.dumps({"success": True, "pet": response})
    except Exception as e:
        logger.error("create_pet_failed", {"name": name, "owner_id": owner_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_pets_by_owner(owner_id: int) -> str:
    """
    Get all pets owned by a specific customer.
    Args:
        owner_id: ID of the customer/owner
    Returns: JSON string containing the owner's pets
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/pet/owner/{owner_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_pets_by_owner_failed", {"owner_id": owner_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def delete_pet(pet_id: int) -> str:
    """
    Delete a pet by ID.
    Args:
        pet_id: The ID of the pet to delete
    Returns: JSON string with deletion status
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        await client.delete(f"/pet/{pet_id}")
        return json.dumps({"success": True, "message": f"Pet {pet_id} deleted"})
    except Exception as e:
        logger.error("delete_pet_failed", {"pet_id": pet_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# EMPLOYEE OPERATIONS
# ============================================================================

@tool
async def get_employee_schedule(employee_id: int) -> str:
    """
    Get schedule for an employee.
    Args:
        employee_id: The ID of the employee
    Returns: JSON string containing the employee's schedule
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/schedule/employee/{employee_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_schedule_failed", {"employee_id": employee_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_all_employees() -> str:
    """
    Get all employees from the petstore.
    Returns: JSON string containing all employees
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/user/employee")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_all_employees_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_employee_by_id(employee_id: int) -> str:
    """
    Get employee details by ID.
    Args:
        employee_id: The ID of the employee
    Returns: JSON string containing employee details
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/user/employee/{employee_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_employee_by_id_failed", {"employee_id": employee_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def create_employee(name: str, skills: List[str], days_available: List[str]) -> str:
    """
    Create a new employee.
    Args:
        name: Name of the employee
        skills: List of skills (e.g., ["PETTING", "WALKING", "FEEDING", "MEDICATING", "SHAVING"])
        days_available: List of available days (e.g., ["MONDAY", "TUESDAY", "WEDNESDAY","THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])
    Returns: JSON string containing the created employee
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.post("/user/employee", json={
            "name": name,
            "skills": skills,
            "daysAvailable": days_available
        })
        return json.dumps({"success": True, "employee": response})
    except Exception as e:
        logger.error("create_employee_failed", {"name": name, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def set_employee_availability(employee_id: int, days_available: List[str]) -> str:
    """
    Update employee's availability.
    Args:
        employee_id: The ID of the employee
        days_available: List of available days (e.g., ["MONDAY", "TUESDAY", "WEDNESDAY"])
    Returns: JSON string with update status
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.put(f"/user/employee/{employee_id}/availability", json={
            "daysAvailable": days_available
        })
        return json.dumps({"success": True, "employee": response})
    except Exception as e:
        logger.error("set_employee_availability_failed", {"employee_id": employee_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def find_available_employees(skills: List[str], date: str) -> str:
    """
    Find employees available with specific skills on a given date.
    Args:
        skills: List of required skills (e.g., ["FEEDING", "WALKING"])
        date: Date to check availability (YYYY-MM-DD format)
    Returns: JSON string containing available employees
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.post("/user/employee/available", json={
            "skills": skills,
            "date": date
        })
        return json.dumps(response)
    except Exception as e:
        logger.error("find_available_employees_failed", {"skills": skills, "date": date, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def delete_employee(employee_id: int) -> str:
    """
    Delete an employee by ID.
    Args:
        employee_id: The ID of the employee to delete
    Returns: JSON string with deletion status
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        await client.delete(f"/user/employee/{employee_id}")
        return json.dumps({"success": True, "message": f"Employee {employee_id} deleted"})
    except Exception as e:
        logger.error("delete_employee_failed", {"employee_id": employee_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# CUSTOMER OPERATIONS
# ============================================================================

@tool
async def get_all_customers() -> str:
    """
    Get all customers from the petstore.
    Returns: JSON string containing all customers
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/user/customer")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_all_customers_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_customer_by_id(customer_id: int) -> str:
    """
    Get customer details by ID.
    Args:
        customer_id: The ID of the customer
    Returns: JSON string containing customer details
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/user/customer/{customer_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_customer_by_id_failed", {"customer_id": customer_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def create_customer(name: str, phone_number: str, notes: str = None) -> str:
    """
    Create a new customer.
    Args:
        name: Name of the customer
        phone_number: Customer's phone number
        notes: Optional notes about the customer
    Returns: JSON string containing the created customer
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        customer_data = {
            "name": name,
            "phoneNumber": phone_number
        }
        if notes:
            customer_data["notes"] = notes
            
        response = await client.post("/user/customer", json=customer_data)
        return json.dumps({"success": True, "customer": response})
    except Exception as e:
        logger.error("create_customer_failed", {"name": name, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_customer_by_pet(pet_id: int) -> str:
    """
    Get the customer/owner of a specific pet.
    Args:
        pet_id: The ID of the pet
    Returns: JSON string containing the customer details
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/user/customer/pet/{pet_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_customer_by_pet_failed", {"pet_id": pet_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def delete_customer(customer_id: int) -> str:
    """
    Delete a customer by ID.
    Args:
        customer_id: The ID of the customer to delete
    Returns: JSON string with deletion status
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        await client.delete(f"/user/customer/{customer_id}")
        return json.dumps({"success": True, "message": f"Customer {customer_id} deleted"})
    except Exception as e:
        logger.error("delete_customer_failed", {"customer_id": customer_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def update_customer(customer_id: int, name: str = None, phone_number: str = None, notes: str = None) -> str:
    """
    Update a customer's information.
    Args:
        customer_id: The ID of the customer to update
        name: New name (optional)
        phone_number: New phone number (optional)
        notes: New notes (optional)
    Returns: JSON string containing the updated customer
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        update_data = {}
        if name:
            update_data["name"] = name
        if phone_number:
            update_data["phoneNumber"] = phone_number
        if notes is not None:
            update_data["notes"] = notes
            
        response = await client.put(f"/user/customer/{customer_id}", json=update_data)
        return json.dumps({"success": True, "customer": response})
    except Exception as e:
        logger.error("update_customer_failed", {"customer_id": customer_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# SCHEDULE OPERATIONS
# ============================================================================

@tool
async def get_all_schedules() -> str:
    """
    Get all schedules from the petstore.
    Returns: JSON string containing all schedules
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/schedule")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_all_schedules_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def create_schedule(date: str, employee_ids: List[int], pet_ids: List[int], activities: List[str]) -> str:
    """
    Create a new schedule.
    Args:
        date: Date for the schedule (YYYY-MM-DD format)
        employee_ids: List of employee IDs for this schedule
        pet_ids: List of pet IDs for this schedule
        activities: List of activities (e.g., ["FEEDING", "WALKING", "GROOMING"])
    Returns: JSON string containing the created schedule
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.post("/schedule", json={
            "date": date,
            "employeeIds": employee_ids,
            "petIds": pet_ids,
            "activities": activities
        })
        return json.dumps({"success": True, "schedule": response})
    except Exception as e:
        logger.error("create_schedule_failed", {"date": date, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def get_customer_schedule(customer_id: int) -> str:
    """
    Get schedule for a specific customer (their pets' appointments).
    Args:
        customer_id: The ID of the customer
    Returns: JSON string containing the customer's schedule
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/schedule/customer/{customer_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_customer_schedule_failed", {"customer_id": customer_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_pet_schedule(pet_id: int) -> str:
    """
    Get schedule for a specific pet.
    Args:
        pet_id: The ID of the pet
    Returns: JSON string containing the pet's schedule
    """
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get(f"/schedule/pet/{pet_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_pet_schedule_failed", {"pet_id": pet_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


# ============================================================================
# HELPER FUNCTIONS (non-tool)
# ============================================================================

async def fetch_pets() -> List[Dict[str, Any]]:
    """Direct function to fetch all pets"""
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/pet")
        if isinstance(response, dict):
            return response.get("pets", [])
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_pets_failed", {"error": str(e)}, error=e)
        return []


async def fetch_employees() -> List[Dict[str, Any]]:
    """Direct function to fetch all employees"""
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/user/employee")
        if isinstance(response, dict):
            return response.get("employees", [])
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_employees_failed", {"error": str(e)}, error=e)
        return []


async def fetch_customers() -> List[Dict[str, Any]]:
    """Direct function to fetch all customers"""
    try:
        client = ServiceHTTPClients.get_petstore_client()
        response = await client.get("/user/customer")
        if isinstance(response, dict):
            return response.get("customers", [])
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_customers_failed", {"error": str(e)}, error=e)
        return []


def get_petstore_tools():
    """Return all petstore tools as a list"""
    return [
        # Pet tools
        get_pet,
        add_pet,
        update_pet,
        find_pets_by_status,
        get_all_pets,
        create_pet,
        get_pets_by_owner,
        delete_pet,
        # Employee tools
        get_employee_schedule,
        get_all_employees,
        get_employee_by_id,
        create_employee,
        set_employee_availability,
        find_available_employees,
        delete_employee,
        # Customer tools
        get_all_customers,
        get_customer_by_id,
        create_customer,
        get_customer_by_pet,
        delete_customer,
        update_customer,
        # Schedule tools
        get_all_schedules,
        create_schedule,
        get_customer_schedule,
        get_pet_schedule
    ]
