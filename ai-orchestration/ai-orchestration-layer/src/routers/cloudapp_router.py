"""
CloudApp Router - Connects to the portfolio CloudApp Spring Boot backend
Replaces mock data with real API calls to the CloudApp service.

Portfolio CloudApp runs on port 8099 with the following endpoints:
- POST /user/create - Create user
- GET /user/id/{id} - Get user by ID
- GET /user/{username} - Get user by username
- POST /cart/addToCart - Add item to cart
- POST /cart/removeFromCart - Remove item from cart
- POST /cart/getCart - Get user's cart
- POST /cart/clearCart - Clear cart
- GET /item - Get all items
- GET /item/{id} - Get item by ID
- GET /item/name/{name} - Search items by name
- POST /order/submit/{username} - Submit order
- GET /order/history/{username} - Get order history
- POST /note/create - Create note
- GET /note/user/{username} - Get user notes
- PUT /note/update - Update note
- DELETE /note/{id} - Delete note
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import httpx

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["CloudApp"])

# Configuration - should be moved to environment variables
CLOUDAPP_BASE_URL = "http://cloudapp:8099/cloudapp"
REQUEST_TIMEOUT = 10.0


# =============================================================================
# Pydantic Models
# =============================================================================

class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str


class Item(BaseModel):
    id: int
    name: str
    description: str
    price: float
    category: Optional[str] = None
    stock: Optional[int] = None


class CartItem(BaseModel):
    item_id: int = Field(alias="itemId")
    item_name: str = Field(alias="itemName", default="")
    quantity: int
    price: float

    class Config:
        populate_by_name = True


class Cart(BaseModel):
    items: List[CartItem] = []
    total: float = 0.0


class CartModifyRequest(BaseModel):
    username: str
    item_id: int = Field(alias="itemId")
    quantity: int = 1

    class Config:
        populate_by_name = True


class Order(BaseModel):
    id: int
    username: str
    items: List[CartItem] = []
    total: float
    status: str = "completed"
    created_at: str = Field(alias="createdAt", default="")

    class Config:
        populate_by_name = True


class NoteCreate(BaseModel):
    username: str
    title: str
    description: str


class NoteUpdate(BaseModel):
    id: int
    title: str
    description: str


class Note(BaseModel):
    id: int
    title: str
    description: str
    created_at: str = Field(default="")
    user: Optional[str] = None


class RoomCreate(BaseModel):
    name: str
    username: str


class Room(BaseModel):
    id: str
    name: str
    code: str
    created_by: str = Field(alias="createdBy", default="")
    created_at: Optional[int] = Field(alias="createdAt", default=None)

    class Config:
        populate_by_name = True


# =============================================================================
# HTTP Client Helper
# =============================================================================

async def make_request(
    method: str,
    endpoint: str,
    json_data: dict = None,
    params: dict = None
) -> dict:
    """Make HTTP request to CloudApp backend with error handling."""
    url = f"{CLOUDAPP_BASE_URL}{endpoint}"
    
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
            
            # Handle empty responses
            if response.status_code == 204 or not response.content:
                return {}
            
            return response.json()
            
        except httpx.ConnectError as e:
            logger.error(f"CloudApp connection error: {e}")
            raise HTTPException(
                status_code=503,
                detail=f"CloudApp service unavailable: {str(e)}"
            )
        except httpx.TimeoutException as e:
            logger.error(f"CloudApp timeout: {e}")
            raise HTTPException(
                status_code=504,
                detail="CloudApp service timeout"
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"CloudApp HTTP error: {e.response.status_code}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"CloudApp error: {e.response.text}"
            )


# =============================================================================
# User Endpoints
# =============================================================================

@router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    """Create a new user in CloudApp."""
    data = await make_request("POST", "/user/create", json_data={
        "username": user.username,
        "password": user.password
    })
    return UserResponse(**data)


@router.get("/users/{username}", response_model=UserResponse)
async def get_user_by_username(username: str):
    """Get user by username."""
    data = await make_request("GET", f"/user/{username}")
    return UserResponse(**data)


@router.get("/users/id/{user_id}", response_model=UserResponse)
async def get_user_by_id(user_id: int):
    """Get user by ID."""
    data = await make_request("GET", f"/user/id/{user_id}")
    return UserResponse(**data)


# =============================================================================
# Items Endpoints
# =============================================================================

@router.get("/item", response_model=dict)
async def get_all_items():
    """Get all items from the shop."""
    try:
        data = await make_request("GET", "/item")
        # CloudApp returns a list directly
        items = data if isinstance(data, list) else data.get("items", [])
        return {"items": items, "total": len(items)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/item/{item_id}", response_model=Item)
async def get_item_by_id(item_id: int):
    """Get a specific item by ID."""
    data = await make_request("GET", f"/item/{item_id}")
    return Item(**data)


@router.get("/item/search", response_model=dict)
async def search_items_by_name(name: str = Query(..., min_length=1)):
    """Search items by name."""
    data = await make_request("GET", f"/item/name/{name}")
    items = data if isinstance(data, list) else data.get("items", [])
    return {"items": items, "total": len(items)}


# =============================================================================
# Cart Endpoints
# =============================================================================

@router.get("/cart/{username}", response_model=Cart)
async def get_cart(username: str):
    """Get user's shopping cart."""
    data = await make_request("POST", "/cart/getCart", json_data={
        "username": username
    })
    
    # Transform CloudApp cart response to our format
    items = []
    total = 0.0
    
    if data and "items" in data:
        for item in data["items"]:
            cart_item = CartItem(
                itemId=item.get("id", 0),
                itemName=item.get("name", ""),
                quantity=1,  # CloudApp stores items individually
                price=float(item.get("price", 0))
            )
            items.append(cart_item)
            total += cart_item.price
    
    if data and "total" in data:
        total = float(data["total"])
    
    return Cart(items=items, total=total)


@router.post("/cart/{username}/add", response_model=Cart)
async def add_to_cart(username: str, request: CartModifyRequest):
    """Add item to cart."""
    data = await make_request("POST", "/cart/addToCart", json_data={
        "username": username,
        "itemId": request.item_id,
        "quantity": request.quantity
    })
    
    # Return updated cart
    return await get_cart(username)


@router.post("/cart/{username}/remove", response_model=Cart)
async def remove_from_cart(username: str, request: CartModifyRequest):
    """Remove item from cart."""
    data = await make_request("POST", "/cart/removeFromCart", json_data={
        "username": username,
        "itemId": request.item_id,
        "quantity": request.quantity
    })
    
    return await get_cart(username)


@router.post("/cart/{username}/clear")
async def clear_cart(username: str):
    """Clear user's cart."""
    await make_request("POST", "/cart/clearCart", json_data={
        "username": username
    })
    return {"status": "success", "message": "Cart cleared"}


# =============================================================================
# Order Endpoints
# =============================================================================

@router.get("/order/{username}", response_model=dict)
async def get_order_history(username: str):
    """Get user's order history."""
    data = await make_request("GET", f"/order/history/{username}")
    orders = data if isinstance(data, list) else data.get("orders", [])
    
    formatted_orders = []
    for order in orders:
        formatted_orders.append({
            "id": order.get("id", 0),
            "username": username,
            "items": order.get("items", []),
            "total": float(order.get("total", 0)),
            "status": "completed",
            "created_at": order.get("createdAt", "")
        })
    
    return {"orders": formatted_orders, "total": len(formatted_orders)}


@router.post("/order/submit/{username}", response_model=Order)
async def submit_order(username: str):
    """Submit the current cart as an order."""
    data = await make_request("POST", f"/order/submit/{username}")
    return Order(
        id=data.get("id", 0),
        username=username,
        items=data.get("items", []),
        total=float(data.get("total", 0)),
        status="completed",
        createdAt=data.get("createdAt", "")
    )


# =============================================================================
# Notes Endpoints
# =============================================================================

@router.get("/note/user/{username}", response_model=dict)
async def get_user_notes(username: str):
    """Get all notes for a user."""
    data = await make_request("GET", f"/note/user/{username}")
    notes = data if isinstance(data, list) else data.get("notes", [])
    return {"notes": notes, "total": len(notes)}


@router.post("/note", response_model=Note)
async def create_note(note: NoteCreate):
    """Create a new note."""
    data = await make_request("POST", "/note/create", json_data={
        "username": note.username,
        "title": note.title,
        "description": note.description
    })
    return Note(**data)


@router.put("/note/{note_id}", response_model=Note)
async def update_note(note_id: int, note: NoteUpdate):
    """Update an existing note."""
    data = await make_request("PUT", "/note/update", json_data={
        "id": note_id,
        "title": note.title,
        "description": note.description
    })
    return Note(**data)


@router.delete("/note/{note_id}")
async def delete_note(note_id: int):
    """Delete a note."""
    await make_request("DELETE", f"/note/{note_id}")
    return {"status": "success", "message": "Note deleted"}


# =============================================================================
# Rooms Endpoints (Chat functionality)
# =============================================================================

@router.post("/room", response_model=Room)
async def create_room(room: RoomCreate):
    """Create a new chat room."""
    data = await make_request("POST", "/room/create", json_data={
        "name": room.name,
        "username": room.username
    })
    return Room(**data)


@router.get("/room/{code}", response_model=Room)
async def get_room_by_code(code: str):
    """Get room by code."""
    data = await make_request("GET", f"/room/{code}")
    return Room(**data)


@router.get("/room/user/{username}", response_model=dict)
async def get_user_rooms(username: str):
    """Get all rooms for a user."""
    data = await make_request("GET", f"/room/user/{username}")
    rooms = data if isinstance(data, list) else data.get("rooms", [])
    return {"rooms": rooms, "total": len(rooms)}


# =============================================================================
# Health Check
# =============================================================================

@router.get("/health")
async def health_check():
    """Check CloudApp backend health."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{CLOUDAPP_BASE_URL}/actuator/health")
            if response.status_code == 200:
                return {"status": "healthy", "service": "cloudapp", "backend_status": response.json()}
    except Exception as e:
        logger.warning(f"CloudApp health check failed: {e}")
    
    return {"status": "unhealthy", "service": "cloudapp", "error": "Backend unreachable"}
