# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/vehicle_tools.py
# VEHICLES API TOOLS - COMPREHENSIVE VERSION
# ============================================================================
#
# Handles Spring HATEOAS response format where the Vehicles API returns:
# {"_embedded": {"carList": [...]}, "_links": {...}}
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
    logger = logging.getLogger("vehicle_tools")


# ============================================================================
# HELPER FUNCTION - Extract vehicles from HATEOAS or plain list response
# ============================================================================

def _extract_vehicles_list(response: Any) -> Optional[List[Dict]]:
    """
    Extract vehicles list from API response.
    Handles both HATEOAS format and plain list format.

    Args:
        response: API response (could be dict with _embedded or plain list)

    Returns:
        List of vehicle dicts, or None if invalid format
    """
    # Handle HATEOAS format: {"_embedded": {"carList": [...]}}
    if isinstance(response, dict):
        if "_embedded" in response:
            return response.get("_embedded", {}).get("carList", [])
        # Some endpoints might return {"vehicles": [...]} or {"cars": [...]}
        if "vehicles" in response:
            return response.get("vehicles", [])
        if "cars" in response:
            return response.get("cars", [])
        # If it's a single vehicle object, wrap in list
        if "id" in response:
            return [response]
        return None

    # Handle plain list format
    if isinstance(response, list):
        return response

    return None


# ============================================================================
# BASIC VEHICLE TOOLS
# ============================================================================

@tool
async def get_vehicles() -> str:
    """
    Get all vehicles from the inventory.
    Returns: JSON string containing all vehicles
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_vehicles_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_vehicle_by_id(vehicle_id: int) -> str:
    """
    Get vehicle details by ID.
    Args:
        vehicle_id: The ID of the vehicle to retrieve
    Returns: JSON string containing vehicle details
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get(f"/cars/{vehicle_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_vehicle_by_id_failed", {"vehicle_id": vehicle_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


# ============================================================================
# SEARCH TOOLS
# ============================================================================

@tool
async def search_vehicles_by_make(make: str) -> str:
    """
    Search vehicles by manufacturer make.
    Args:
        make: Manufacturer name to search for (e.g., "Toyota", "Honda")
    Returns: JSON string containing matching vehicles
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")

        all_vehicles = _extract_vehicles_list(response)
        if all_vehicles is None:
            logger.warning("search_by_make_invalid_response", {"response_type": type(response).__name__})
            return json.dumps({"success": False, "error": "Invalid response format from Vehicles API"})

        # Filter by make - check multiple possible field locations
        matches = []
        for v in all_vehicles:
            # Check direct 'make' field
            vehicle_make = v.get("make", "")
            # Also check nested in 'details.manufacturer'
            if not vehicle_make:
                details = v.get("details", {})
                manufacturer = details.get("manufacturer", {})
                if isinstance(manufacturer, dict):
                    vehicle_make = manufacturer.get("name", "")
                elif isinstance(manufacturer, str):
                    vehicle_make = manufacturer

            if vehicle_make and make.lower() in vehicle_make.lower():
                matches.append(v)

        return json.dumps({
            "success": True,
            "make": make,
            "count": len(matches),
            "vehicles": matches
        })
    except Exception as e:
        logger.error("search_by_make_failed", {"make": make, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def search_vehicles_by_model(model: str) -> str:
    """
    Search vehicles by model name.
    Args:
        model: Model name to search for (e.g., "Camry", "Civic")
    Returns: JSON string containing matching vehicles
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")

        all_vehicles = _extract_vehicles_list(response)
        if all_vehicles is None:
            logger.warning("search_by_model_invalid_response", {"response_type": type(response).__name__})
            return json.dumps({"success": False, "error": "Invalid response format from Vehicles API"})

        # Filter by model - check multiple possible field locations
        matches = []
        for v in all_vehicles:
            # Check direct 'model' field
            vehicle_model = v.get("model", "")
            # Also check nested in 'details.model'
            if not vehicle_model:
                vehicle_model = v.get("details", {}).get("model", "")

            if vehicle_model and model.lower() in vehicle_model.lower():
                matches.append(v)

        return json.dumps({
            "success": True,
            "model": model,
            "count": len(matches),
            "vehicles": matches
        })
    except Exception as e:
        logger.error("search_by_model_failed", {"model": model, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def search_vehicles_by_year(year: int) -> str:
    """
    Search vehicles by manufacturing year.
    Args:
        year: Manufacturing year to search for
    Returns: JSON string containing matching vehicles
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")

        all_vehicles = _extract_vehicles_list(response)
        if all_vehicles is None:
            logger.warning("search_by_year_invalid_response", {"response_type": type(response).__name__})
            return json.dumps({"success": False, "error": "Invalid response format from Vehicles API"})

        # Filter by year - check multiple possible field locations
        matches = []
        for v in all_vehicles:
            # Check direct 'year' field
            vehicle_year = v.get("year")
            # Also check nested in 'details.modelYear'
            if vehicle_year is None:
                vehicle_year = v.get("details", {}).get("modelYear")
            # Also check 'details.productionYear'
            if vehicle_year is None:
                vehicle_year = v.get("details", {}).get("productionYear")

            if vehicle_year is not None and int(vehicle_year) == year:
                matches.append(v)

        return json.dumps({
            "success": True,
            "year": year,
            "count": len(matches),
            "vehicles": matches
        })
    except Exception as e:
        logger.error("search_by_year_failed", {"year": year, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def search_vehicles_by_price_range(min_price: float, max_price: float) -> str:
    """
    Search vehicles within a price range.
    Args:
        min_price: Minimum price
        max_price: Maximum price
    Returns: JSON string containing matching vehicles
    """
    if min_price > max_price:
        return json.dumps({"success": False, "error": "Min price cannot be greater than max price"})

    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")

        all_vehicles = _extract_vehicles_list(response)
        if all_vehicles is None:
            logger.warning("search_by_price_invalid_response", {"response_type": type(response).__name__})
            return json.dumps({"success": False, "error": "Invalid response format from Vehicles API"})

        # Filter by price range
        matches = []
        for v in all_vehicles:
            # Get price - might be string with currency formatting or number
            price_raw = v.get("price", 0)

            try:
                if isinstance(price_raw, str):
                    # Handle currency formatted strings like "$28,999.00"
                    price = float(price_raw.replace("$", "").replace(",", ""))
                else:
                    price = float(price_raw)
            except (ValueError, TypeError):
                price = 0

            if min_price <= price <= max_price:
                matches.append(v)

        return json.dumps({
            "success": True,
            "range": {"min": min_price, "max": max_price},
            "count": len(matches),
            "vehicles": matches
        })
    except Exception as e:
        logger.error("search_by_price_failed", {"error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def search_vehicles(
    manufacturer: str = None, 
    condition: str = None, 
    min_price: float = None, 
    max_price: float = None,
    min_year: int = None,
    max_year: int = None
) -> str:
    """
    Search vehicles with multiple criteria.
    Args:
        manufacturer: Manufacturer name filter (optional)
        condition: Vehicle condition - NEW, USED, CERTIFIED (optional)
        min_price: Minimum price filter (optional)
        max_price: Maximum price filter (optional)
        min_year: Minimum year filter (optional)
        max_year: Maximum year filter (optional)
    Returns: JSON string containing matching vehicles
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        
        # Build query params
        params = {}
        if manufacturer:
            params["manufacturer"] = manufacturer
        if condition:
            params["condition"] = condition
        if min_price is not None:
            params["min_price"] = min_price
        if max_price is not None:
            params["max_price"] = max_price
        if min_year is not None:
            params["min_year"] = min_year
        if max_year is not None:
            params["max_year"] = max_year
        
        if params:
            response = await client.get("/cars/search", params=params)
        else:
            response = await client.get("/cars")
            
        return json.dumps(response)
    except Exception as e:
        logger.error("search_vehicles_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


# ============================================================================
# AVAILABILITY TOOL
# ============================================================================

@tool
async def get_available_vehicles() -> str:
    """
    Get vehicles that are available and not sold.
    Returns: JSON string containing available vehicles
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")

        all_vehicles = _extract_vehicles_list(response)
        if all_vehicles is None:
            logger.warning("get_available_invalid_response", {"response_type": type(response).__name__})
            return json.dumps({"success": False, "error": "Invalid response format from Vehicles API"})

        # Filter for available vehicles (not sold)
        available = []
        for v in all_vehicles:
            status = v.get("status", "").lower()
            condition = v.get("condition", "").upper()
            is_sold = v.get("sold", False)

            # Consider available if not explicitly sold
            if not is_sold and status != "sold":
                available.append(v)

        return json.dumps({
            "success": True,
            "count": len(available),
            "vehicles": available
        })
    except Exception as e:
        logger.error("get_available_vehicles_failed", {"error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# CRUD OPERATIONS
# ============================================================================

@tool
async def create_vehicle(condition: str, details: Dict[str, Any], location: Dict[str, Any] = None) -> str:
    """
    Create a new vehicle listing.
    Args:
        condition: Vehicle condition (NEW, USED, CERTIFIED)
        details: Vehicle details including make, model, year, price, etc.
        location: Vehicle location information (optional)
    Returns: JSON string containing the created vehicle
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        vehicle_data = {
            "condition": condition,
            "details": details
        }
        if location:
            vehicle_data["location"] = location
            
        response = await client.post("/cars", json=vehicle_data)
        return json.dumps({"success": True, "vehicle": response})
    except Exception as e:
        logger.error("create_vehicle_failed", {"condition": condition, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def update_vehicle(vehicle_id: int, updates: Dict[str, Any]) -> str:
    """
    Update an existing vehicle.
    Args:
        vehicle_id: The ID of the vehicle to update
        updates: Dictionary of fields to update
    Returns: JSON string containing the updated vehicle
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.put(f"/cars/{vehicle_id}", json=updates)
        return json.dumps({"success": True, "vehicle": response})
    except Exception as e:
        logger.error("update_vehicle_failed", {"vehicle_id": vehicle_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


@tool
async def delete_vehicle(vehicle_id: int) -> str:
    """
    Delete a vehicle by ID.
    Args:
        vehicle_id: The ID of the vehicle to delete
    Returns: JSON string with deletion status
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        await client.delete(f"/cars/{vehicle_id}")
        return json.dumps({"success": True, "message": f"Vehicle {vehicle_id} deleted"})
    except Exception as e:
        logger.error("delete_vehicle_failed", {"vehicle_id": vehicle_id, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# REFERENCE DATA
# ============================================================================

@tool
async def get_manufacturers() -> str:
    """
    Get list of all vehicle manufacturers.
    Returns: JSON string containing manufacturers list
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/manufacturers")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_manufacturers_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_vehicle_stats() -> str:
    """
    Get vehicle inventory statistics.
    Returns: JSON string containing inventory stats
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/stats")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_vehicle_stats_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_vehicles_by_condition(condition: str) -> str:
    """
    Get vehicles by condition.
    Args:
        condition: Vehicle condition (NEW, USED, CERTIFIED)
    Returns: JSON string containing vehicles with the specified condition
    """
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")
        
        all_vehicles = _extract_vehicles_list(response)
        if all_vehicles is None:
            return json.dumps({"success": False, "error": "Invalid response format"})
        
        # Filter by condition
        matches = [
            v for v in all_vehicles
            if v.get("condition", "").upper() == condition.upper()
        ]
        
        return json.dumps({
            "success": True,
            "condition": condition,
            "count": len(matches),
            "vehicles": matches
        })
    except Exception as e:
        logger.error("get_vehicles_by_condition_failed", {"condition": condition, "error": str(e)}, error=e)
        return json.dumps({"success": False, "error": str(e)})


# ============================================================================
# STANDALONE HELPER (non-tool)
# ============================================================================

async def fetch_vehicles() -> Optional[List[Dict[str, Any]]]:
    """Direct function to fetch vehicles (non-tool)"""
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/cars")
        return _extract_vehicles_list(response)
    except Exception as e:
        logger.error("fetch_vehicles_failed", {"error": str(e)}, error=e)
        return None


async def fetch_manufacturers() -> List[Dict[str, Any]]:
    """Direct function to fetch manufacturers"""
    try:
        client = ServiceHTTPClients.get_vehicles_client()
        response = await client.get("/manufacturers")
        if isinstance(response, dict):
            return response.get("manufacturers", [])
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_manufacturers_failed", {"error": str(e)}, error=e)
        return []


# ============================================================================
# TOOL LIST EXPORT
# ============================================================================

def get_vehicle_tools():
    """Return all vehicle tools as a list"""
    return [
        get_vehicles,
        get_vehicle_by_id,
        search_vehicles_by_make,
        search_vehicles_by_model,
        search_vehicles_by_year,
        search_vehicles_by_price_range,
        search_vehicles,
        get_available_vehicles,
        create_vehicle,
        update_vehicle,
        delete_vehicle,
        get_manufacturers,
        get_vehicle_stats,
        get_vehicles_by_condition
    ]
