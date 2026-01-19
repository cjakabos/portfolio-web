# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/tool_manager.py
# TOOL MANAGER - CENTRAL REGISTRY
# ============================================================================

from typing import List, Dict, Optional
from langchain_core.tools import BaseTool

# Core CloudApp
from .cloudapp_tools import (
    get_items, get_item_by_id, search_items_by_name,
    get_user_by_username, get_user_by_id, create_user,
    get_order_history, submit_order, get_order_by_id,
    create_room, get_room_by_code, get_user_rooms, delete_room
)

# Cart Module
from .cart_tools import (
    get_cart, add_item_to_cart, remove_item_from_cart, clear_cart,
    update_cart_item_quantity, get_cart_total
)

# Notes Module
from .note_tools import (
    create_note, delete_note, search_user_notes,
    get_user_notes, get_note_by_id, update_note, get_notes_count
)

# Room Bookings Module
from .room_tools import (
    get_room_bookings, create_room_booking, cancel_room_booking,
    get_user_bookings, get_available_rooms, get_all_rooms,
    get_room_details, update_room_booking
)

# Web Proxy Module
from .web_proxy_tools import (
    proxy_request, proxy_get, proxy_post, proxy_put, 
    proxy_delete, fetch_external_json
)

# Petstore Module
from .petstore_tools import (
    # Pet tools
    get_pet, add_pet, update_pet, find_pets_by_status,
    get_all_pets, create_pet, get_pets_by_owner, delete_pet,
    # Employee tools
    get_employee_schedule, get_all_employees, get_employee_by_id,
    create_employee, set_employee_availability, find_available_employees,
    delete_employee,
    # Customer tools
    get_all_customers, get_customer_by_id, create_customer,
    get_customer_by_pet, delete_customer, update_customer,
    # Schedule tools
    get_all_schedules, create_schedule, get_customer_schedule, get_pet_schedule
)

# Vehicle Module
from .vehicle_tools import (
    get_vehicles, get_vehicle_by_id,
    search_vehicles_by_make, search_vehicles_by_model,
    search_vehicles_by_year, search_vehicles_by_price_range,
    search_vehicles, get_available_vehicles,
    create_vehicle, update_vehicle, delete_vehicle,
    get_manufacturers, get_vehicle_stats, get_vehicles_by_condition
)

# ML Module
from .ml_tools import (
    get_segmentation, get_predictions, run_diagnostics,
    get_model_info, list_models, get_model_metrics,
    batch_predict, get_feature_importance, explain_prediction, get_ml_health
)


class ToolManager:
    """
    Central registry for all AI tools.
    Aggregates tools from separated service modules.
    """

    def __init__(self):
        self._initialize_registries()

    def _initialize_registries(self):
        """Initialize tool categories"""

        # CloudApp Ecosystem - Core
        self.cloudapp_core_tools = [
            get_items, get_item_by_id, search_items_by_name,
            get_user_by_username, get_user_by_id, create_user,
            get_order_history, submit_order, get_order_by_id,
            create_room, get_room_by_code, get_user_rooms, delete_room
        ]

        # CloudApp Ecosystem - Cart
        self.cart_tools = [
            get_cart, add_item_to_cart, remove_item_from_cart, clear_cart,
            update_cart_item_quantity, get_cart_total
        ]

        # CloudApp Ecosystem - Notes
        self.note_tools = [
            create_note, delete_note, search_user_notes,
            get_user_notes, get_note_by_id, update_note, get_notes_count
        ]

        # CloudApp Ecosystem - Room Bookings
        self.room_tools = [
            get_room_bookings, create_room_booking, cancel_room_booking,
            get_user_bookings, get_available_rooms, get_all_rooms,
            get_room_details, update_room_booking
        ]

        # Combined CloudApp Tools
        self.cloudapp_tools = (
            self.cloudapp_core_tools +
            self.cart_tools +
            self.note_tools +
            self.room_tools
        )

        # Petstore - Pets
        self.pet_tools = [
            get_pet, add_pet, update_pet, find_pets_by_status,
            get_all_pets, create_pet, get_pets_by_owner, delete_pet
        ]

        # Petstore - Employees
        self.employee_tools = [
            get_employee_schedule, get_all_employees, get_employee_by_id,
            create_employee, set_employee_availability, find_available_employees,
            delete_employee
        ]

        # Petstore - Customers
        self.customer_tools = [
            get_all_customers, get_customer_by_id, create_customer,
            get_customer_by_pet, delete_customer, update_customer
        ]

        # Petstore - Schedules
        self.schedule_tools = [
            get_all_schedules, create_schedule, get_customer_schedule, get_pet_schedule
        ]

        # Combined Petstore Tools
        self.petstore_tools = (
            self.pet_tools +
            self.employee_tools +
            self.customer_tools +
            self.schedule_tools
        )

        # Vehicles
        self.vehicle_tools = [
            get_vehicles, get_vehicle_by_id,
            search_vehicles_by_make, search_vehicles_by_model,
            search_vehicles_by_year, search_vehicles_by_price_range,
            search_vehicles, get_available_vehicles,
            create_vehicle, update_vehicle, delete_vehicle,
            get_manufacturers, get_vehicle_stats, get_vehicles_by_condition
        ]

        # ML
        self.ml_tools = [
            get_segmentation, get_predictions, run_diagnostics,
            get_model_info, list_models, get_model_metrics,
            batch_predict, get_feature_importance, explain_prediction, get_ml_health
        ]

        # Web Proxy
        self.proxy_tools = [
            proxy_request, proxy_get, proxy_post, proxy_put,
            proxy_delete, fetch_external_json
        ]

        # Combined Registry
        self.all_tools = (
            self.cloudapp_tools +
            self.petstore_tools +
            self.vehicle_tools +
            self.ml_tools +
            self.proxy_tools
        )

        # Name to Tool Map
        self.tool_map = {tool.name: tool for tool in self.all_tools}

        # Category Map
        self.category_map = {
            'cloudapp': self.cloudapp_tools,
            'cloudapp_core': self.cloudapp_core_tools,
            'cart': self.cart_tools,
            'note': self.note_tools,
            'notes': self.note_tools,
            'room': self.room_tools,
            'rooms': self.room_tools,
            'petstore': self.petstore_tools,
            'pet': self.pet_tools,
            'pets': self.pet_tools,
            'employee': self.employee_tools,
            'employees': self.employee_tools,
            'customer': self.customer_tools,
            'customers': self.customer_tools,
            'schedule': self.schedule_tools,
            'schedules': self.schedule_tools,
            'vehicle': self.vehicle_tools,
            'vehicles': self.vehicle_tools,
            'ml': self.ml_tools,
            'mlops': self.ml_tools,
            'proxy': self.proxy_tools,
            'web_proxy': self.proxy_tools
        }

    def get_all_tools(self) -> List[BaseTool]:
        """Get all registered tools"""
        return self.all_tools

    def get_tools_by_service(self, service: str) -> List[BaseTool]:
        """Get tools by service/category name"""
        service = service.lower()
        return self.category_map.get(service, [])

    def get_tool_by_name(self, name: str) -> Optional[BaseTool]:
        """Get a specific tool by name"""
        return self.tool_map.get(name)

    def get_tool_count(self) -> Dict[str, int]:
        """Get count of tools by category"""
        return {
            "total": len(self.all_tools),
            "cloudapp": len(self.cloudapp_tools),
            "cloudapp_core": len(self.cloudapp_core_tools),
            "cart": len(self.cart_tools),
            "notes": len(self.note_tools),
            "rooms": len(self.room_tools),
            "petstore": len(self.petstore_tools),
            "pets": len(self.pet_tools),
            "employees": len(self.employee_tools),
            "customers": len(self.customer_tools),
            "schedules": len(self.schedule_tools),
            "vehicles": len(self.vehicle_tools),
            "ml": len(self.ml_tools),
            "proxy": len(self.proxy_tools)
        }

    def get_categories(self) -> List[str]:
        """Get list of all available categories"""
        return list(set(self.category_map.keys()))

    def search_tools(self, query: str) -> List[BaseTool]:
        """Search tools by name or description"""
        query_lower = query.lower()
        matches = []
        for tool in self.all_tools:
            if (query_lower in tool.name.lower() or 
                query_lower in (tool.description or "").lower()):
                matches.append(tool)
        return matches

    def get_tool_info(self, tool_name: str) -> Optional[Dict]:
        """Get detailed information about a tool"""
        tool = self.tool_map.get(tool_name)
        if not tool:
            return None
        
        return {
            "name": tool.name,
            "description": tool.description,
            "args_schema": tool.args_schema.schema() if tool.args_schema else None
        }

    def list_all_tool_names(self) -> List[str]:
        """Get list of all tool names"""
        return list(self.tool_map.keys())
