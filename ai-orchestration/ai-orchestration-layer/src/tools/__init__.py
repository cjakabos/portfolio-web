# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/__init__.py
# TOOLS PACKAGE - EXPORTS
# ============================================================================

from .http_client import HTTPClient, ServiceHTTPClients

# CloudApp Core Tools
from .cloudapp_tools import (
    get_items, get_item_by_id, search_items_by_name,
    get_user_by_username, get_user_by_id, create_user,
    get_order_history, submit_order, get_order_by_id,
    create_room, get_room_by_code, get_user_rooms, delete_room,
    fetch_items, fetch_user, get_cloudapp_tools
)

# Cart Tools
from .cart_tools import (
    get_cart, add_item_to_cart, remove_item_from_cart, clear_cart,
    update_cart_item_quantity, get_cart_total,
    fetch_cart, fetch_cart_items, get_cart_tools
)

# Note Tools
from .note_tools import (
    create_note, delete_note, search_user_notes,
    get_user_notes, get_note_by_id, update_note, get_notes_count,
    fetch_user_notes, fetch_note, get_note_tools
)

# Room Tools
from .room_tools import (
    get_room_bookings, create_room_booking, cancel_room_booking,
    get_user_bookings, get_available_rooms, get_all_rooms,
    get_room_details, update_room_booking,
    fetch_room_bookings, fetch_rooms, get_room_tools
)

# Web Proxy Tools
from .web_proxy_tools import (
    proxy_request, proxy_get, proxy_post, proxy_put,
    proxy_delete, fetch_external_json,
    make_external_request, get_web_proxy_tools
)

# Petstore Tools
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
    get_all_schedules, create_schedule, get_customer_schedule, get_pet_schedule,
    # Helper functions
    fetch_pets, fetch_employees, fetch_customers, get_petstore_tools
)

# Vehicle Tools
from .vehicle_tools import (
    get_vehicles, get_vehicle_by_id,
    search_vehicles_by_make, search_vehicles_by_model,
    search_vehicles_by_year, search_vehicles_by_price_range,
    search_vehicles, get_available_vehicles,
    create_vehicle, update_vehicle, delete_vehicle,
    get_manufacturers, get_vehicle_stats, get_vehicles_by_condition,
    fetch_vehicles, fetch_manufacturers, get_vehicle_tools
)

# ML Tools
from .ml_tools import (
    get_segmentation, get_predictions, run_diagnostics,
    get_model_info, list_models, get_model_metrics,
    batch_predict, get_feature_importance, explain_prediction, get_ml_health,
    fetch_models, fetch_ml_status, get_ml_tools
)

# Tool Manager
from .tool_manager import ToolManager


__all__ = [
    # HTTP Client
    'HTTPClient', 'ServiceHTTPClients', 'ToolManager',
    
    # CloudApp Core
    'get_items', 'get_item_by_id', 'search_items_by_name',
    'get_user_by_username', 'get_user_by_id', 'create_user',
    'get_order_history', 'submit_order', 'get_order_by_id',
    'create_room', 'get_room_by_code', 'get_user_rooms', 'delete_room',
    'fetch_items', 'fetch_user', 'get_cloudapp_tools',
    
    # Cart
    'get_cart', 'add_item_to_cart', 'remove_item_from_cart', 'clear_cart',
    'update_cart_item_quantity', 'get_cart_total',
    'fetch_cart', 'fetch_cart_items', 'get_cart_tools',
    
    # Notes
    'create_note', 'delete_note', 'search_user_notes',
    'get_user_notes', 'get_note_by_id', 'update_note', 'get_notes_count',
    'fetch_user_notes', 'fetch_note', 'get_note_tools',
    
    # Rooms
    'get_room_bookings', 'create_room_booking', 'cancel_room_booking',
    'get_user_bookings', 'get_available_rooms', 'get_all_rooms',
    'get_room_details', 'update_room_booking',
    'fetch_room_bookings', 'fetch_rooms', 'get_room_tools',
    
    # Proxy
    'proxy_request', 'proxy_get', 'proxy_post', 'proxy_put',
    'proxy_delete', 'fetch_external_json',
    'make_external_request', 'get_web_proxy_tools',
    
    # Petstore - Pets
    'get_pet', 'add_pet', 'update_pet', 'find_pets_by_status',
    'get_all_pets', 'create_pet', 'get_pets_by_owner', 'delete_pet',
    
    # Petstore - Employees
    'get_employee_schedule', 'get_all_employees', 'get_employee_by_id',
    'create_employee', 'set_employee_availability', 'find_available_employees',
    'delete_employee',
    
    # Petstore - Customers
    'get_all_customers', 'get_customer_by_id', 'create_customer',
    'get_customer_by_pet', 'delete_customer', 'update_customer',
    
    # Petstore - Schedules
    'get_all_schedules', 'create_schedule', 'get_customer_schedule', 'get_pet_schedule',
    
    # Petstore - Helpers
    'fetch_pets', 'fetch_employees', 'fetch_customers', 'get_petstore_tools',
    
    # Vehicles
    'get_vehicles', 'get_vehicle_by_id',
    'search_vehicles_by_make', 'search_vehicles_by_model',
    'search_vehicles_by_year', 'search_vehicles_by_price_range',
    'search_vehicles', 'get_available_vehicles',
    'create_vehicle', 'update_vehicle', 'delete_vehicle',
    'get_manufacturers', 'get_vehicle_stats', 'get_vehicles_by_condition',
    'fetch_vehicles', 'fetch_manufacturers', 'get_vehicle_tools',
    
    # ML
    'get_segmentation', 'get_predictions', 'run_diagnostics',
    'get_model_info', 'list_models', 'get_model_metrics',
    'batch_predict', 'get_feature_importance', 'explain_prediction', 'get_ml_health',
    'fetch_models', 'fetch_ml_status', 'get_ml_tools'
]
