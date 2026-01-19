"""
Vehicles Router - Connects to the portfolio Vehicles API Spring Boot backend

FIXED: .dict() → .model_dump() (Pydantic v2)
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

# Configuration
VEHICLES_BASE_URL = "http://vehicles-api:8880/vehicles"
REQUEST_TIMEOUT = 10.0


# =============================================================================
# Pydantic Models
# =============================================================================

class Manufacturer(BaseModel):
    code: int
    name: str


class VehicleDetails(BaseModel):
    manufacturer: str = ""
    model: str = ""
    modelYear: int = 0
    body: str = ""
    fuelType: str = ""
    engine: str = ""
    mileage: int = 0
    externalColor: str = ""
    internalColor: str = ""
    numberOfDoors: int = 4


class VehicleLocation(BaseModel):
    lat: float
    lon: float
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None


class Vehicle(BaseModel):
    id: int
    condition: str  # 'NEW' or 'USED'
    details: VehicleDetails
    location: VehicleLocation
    price: float = 0.0


class VehicleCreate(BaseModel):
    condition: str  # 'NEW' or 'USED'
    details: dict
    location: dict


class VehicleUpdate(BaseModel):
    condition: Optional[str] = None
    details: Optional[dict] = None
    location: Optional[dict] = None


# =============================================================================
# HTTP Client Helper
# =============================================================================

async def make_request(
    method: str,
    endpoint: str,
    json_data: dict = None,
    params: dict = None
) -> dict:
    """Make HTTP request to Vehicles API backend with error handling."""
    url = f"{VEHICLES_BASE_URL}{endpoint}"
    
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
            logger.error(f"Vehicles API connection error: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"Vehicles API service unavailable: {str(e)}"
            )
        except httpx.TimeoutException as e:
            logger.error(f"Vehicles API timeout: {e}")
            raise HTTPException(
                status_code=504,
                detail="Vehicles API service timeout"
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"Vehicles API HTTP error: {e.response.status_code}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Vehicles API error: {e.response.text}"
            )


def transform_vehicle(data: dict) -> dict:
    """Transform Vehicles API response to our format."""
    # Handle HATEOAS response format (Spring Data REST)
    vehicle_data = data
    
    # Extract from _embedded if present (HATEOAS format)
    if "_embedded" in data:
        return data
    
    # Get details
    details_raw = vehicle_data.get("details", {})
    manufacturer = details_raw.get("manufacturer", {})
    
    details = VehicleDetails(
        manufacturer=manufacturer.get("name", "") if isinstance(manufacturer, dict) else str(manufacturer),
        model=details_raw.get("model", ""),
        modelYear=details_raw.get("modelYear", 0),
        body=details_raw.get("body", ""),
        fuelType=details_raw.get("fuelType", ""),
        engine=details_raw.get("engine", ""),
        mileage=details_raw.get("mileage", 0),
        externalColor=details_raw.get("externalColor", ""),
        internalColor=details_raw.get("internalColor", ""),
        numberOfDoors=details_raw.get("numberOfDoors", 4)
    )
    
    # Get location
    location_raw = vehicle_data.get("location", {})
    location = VehicleLocation(
        lat=location_raw.get("lat", 0.0),
        lon=location_raw.get("lon", 0.0),
        address=location_raw.get("address"),
        city=location_raw.get("city"),
        state=location_raw.get("state"),
        zip=location_raw.get("zip")
    )
    
    # Get price (might be string or number)
    price_raw = vehicle_data.get("price", "0")
    try:
        # Handle currency formatted strings like "$28,999.00"
        if isinstance(price_raw, str):
            price = float(price_raw.replace("$", "").replace(",", ""))
        else:
            price = float(price_raw)
    except (ValueError, TypeError):
        price = 0.0
    
    return {
        "id": vehicle_data.get("id", 0),
        "condition": vehicle_data.get("condition", "UNKNOWN"),
        "details": details.model_dump(),  # FIXED: was .dict()
        "location": location.model_dump(),  # FIXED: was .dict()
        "price": price
    }


# =============================================================================
# Vehicle Endpoints
# =============================================================================

@router.get("/cars", response_model=dict)
async def get_all_vehicles():
    """Get all vehicles."""
    try:
        data = await make_request("GET", "/cars")
        
        # Handle HATEOAS list response
        vehicles_list = []
        if isinstance(data, list):
            vehicles_list = data
        elif "_embedded" in data:
            # Spring HATEOAS format
            vehicles_list = data.get("_embedded", {}).get("carList", [])
        
        vehicles = [transform_vehicle(v) for v in vehicles_list]
        return {"vehicles": vehicles, "total": len(vehicles)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching vehicles: {e}")
        return {"vehicles": [], "total": 0}


@router.get("/cars/{vehicle_id}", response_model=Vehicle)
async def get_vehicle_by_id(vehicle_id: int):
    """Get a specific vehicle by ID."""
    data = await make_request("GET", f"/cars/{vehicle_id}")
    transformed = transform_vehicle(data)
    return Vehicle(**transformed)


@router.post("/cars", response_model=Vehicle)
async def create_vehicle(vehicle: VehicleCreate):
    """Create a new vehicle."""
    # Transform to Vehicles API format
    payload = {
        "condition": vehicle.condition,
        "details": {
            "body": vehicle.details.get("body", ""),
            "model": vehicle.details.get("model", ""),
            "manufacturer": {
                "code": vehicle.details.get("manufacturerCode", 101),
                "name": vehicle.details.get("manufacturer", "")
            },
            "numberOfDoors": vehicle.details.get("numberOfDoors", 4),
            "fuelType": vehicle.details.get("fuelType", ""),
            "engine": vehicle.details.get("engine", ""),
            "mileage": vehicle.details.get("mileage", 0),
            "modelYear": vehicle.details.get("modelYear", 2024),
            "productionYear": vehicle.details.get("productionYear", 2024),
            "externalColor": vehicle.details.get("externalColor", ""),
            "internalColor": vehicle.details.get("internalColor", "")
        },
        "location": {
            "lat": vehicle.location.get("lat", 0.0),
            "lon": vehicle.location.get("lon", 0.0)
        }
    }
    
    data = await make_request("POST", "/cars", json_data=payload)
    transformed = transform_vehicle(data)
    return Vehicle(**transformed)


@router.put("/cars/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: int, vehicle: VehicleUpdate):
    """Update an existing vehicle."""
    # First get the existing vehicle
    existing = await make_request("GET", f"/cars/{vehicle_id}")
    
    # Merge updates
    payload = {
        "condition": vehicle.condition or existing.get("condition"),
        "details": vehicle.details or existing.get("details"),
        "location": vehicle.location or existing.get("location")
    }
    
    data = await make_request("PUT", f"/cars/{vehicle_id}", json_data=payload)
    transformed = transform_vehicle(data)
    return Vehicle(**transformed)


@router.delete("/cars/{vehicle_id}")
async def delete_vehicle(vehicle_id: int):
    """Delete a vehicle."""
    await make_request("DELETE", f"/cars/{vehicle_id}")
    return {"status": "success", "message": f"Vehicle {vehicle_id} deleted"}


# =============================================================================
# Search and Filter Endpoints
# =============================================================================

@router.get("/cars/search", response_model=dict)
async def search_vehicles(
    manufacturer: Optional[str] = Query(None, description="Filter by manufacturer"),
    condition: Optional[str] = Query(None, description="Filter by condition (NEW/USED)"),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    min_year: Optional[int] = Query(None, description="Minimum model year"),
    max_year: Optional[int] = Query(None, description="Maximum model year")
):
    """Search vehicles with filters."""
    # Get all vehicles first (Vehicles API doesn't have built-in search)
    result = await get_all_vehicles()
    vehicles = result.get("vehicles", [])
    
    # Apply filters
    filtered = vehicles
    
    if manufacturer:
        filtered = [
            v for v in filtered 
            if manufacturer.lower() in v["details"]["manufacturer"].lower()
        ]
    
    if condition:
        filtered = [
            v for v in filtered 
            if v["condition"].upper() == condition.upper()
        ]
    
    if min_price is not None:
        filtered = [v for v in filtered if v["price"] >= min_price]
    
    if max_price is not None:
        filtered = [v for v in filtered if v["price"] <= max_price]
    
    if min_year is not None:
        filtered = [v for v in filtered if v["details"]["modelYear"] >= min_year]
    
    if max_year is not None:
        filtered = [v for v in filtered if v["details"]["modelYear"] <= max_year]
    
    return {"vehicles": filtered, "total": len(filtered)}


@router.get("/manufacturers", response_model=dict)
async def get_manufacturers():
    """Get available manufacturers."""
    # Based on VehiclesApiApplication initialization
    manufacturers = [
        {"code": 100, "name": "Audi"},
        {"code": 101, "name": "Chevrolet"},
        {"code": 102, "name": "Ford"},
        {"code": 103, "name": "BMW"},
        {"code": 104, "name": "Dodge"}
    ]
    return {"manufacturers": manufacturers, "total": len(manufacturers)}


# =============================================================================
# Statistics Endpoints
# =============================================================================

@router.get("/stats", response_model=dict)
async def get_vehicle_stats():
    """Get vehicle statistics."""
    result = await get_all_vehicles()
    vehicles = result.get("vehicles", [])
    
    if not vehicles:
        return {
            "total_vehicles": 0,
            "new_count": 0,
            "used_count": 0,
            "avg_price": 0,
            "price_range": {"min": 0, "max": 0},
            "by_manufacturer": {}
        }
    
    new_count = sum(1 for v in vehicles if v["condition"] == "NEW")
    used_count = sum(1 for v in vehicles if v["condition"] == "USED")
    prices = [v["price"] for v in vehicles if v["price"] > 0]
    
    by_manufacturer = {}
    for v in vehicles:
        mfr = v["details"]["manufacturer"]
        by_manufacturer[mfr] = by_manufacturer.get(mfr, 0) + 1
    
    return {
        "total_vehicles": len(vehicles),
        "new_count": new_count,
        "used_count": used_count,
        "avg_price": sum(prices) / len(prices) if prices else 0,
        "price_range": {
            "min": min(prices) if prices else 0,
            "max": max(prices) if prices else 0
        },
        "by_manufacturer": by_manufacturer
    }


# =============================================================================
# Health Check
# =============================================================================

@router.get("/health")
async def health_check():
    """Check Vehicles API backend health."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Try the Swagger endpoint which should always be available
            response = await client.get(f"{VEHICLES_BASE_URL}/swagger-ui.html")
            if response.status_code in [200, 302]:
                return {"status": "healthy", "service": "vehicles-api"}
            
            # Also try cars endpoint
            response = await client.get(f"{VEHICLES_BASE_URL}/cars")
            if response.status_code == 200:
                return {"status": "healthy", "service": "vehicles-api"}
    except Exception as e:
        logger.warning(f"Vehicles API health check failed: {e}")
    
    return {"status": "unhealthy", "service": "vehicles-api", "error": "Backend unreachable"}
