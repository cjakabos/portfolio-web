import inspect
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ToolParameter(BaseModel):
    """Schema for a tool parameter."""

    name: str
    type: str
    description: str
    required: bool
    default: Optional[Any] = None


class ToolInfo(BaseModel):
    """Schema for tool information."""

    name: str
    description: str
    category: str
    parameters: List[ToolParameter]
    examples: Optional[List[str]] = []


class ToolDiscoveryResponse(BaseModel):
    """Response for tool discovery endpoints."""

    tools: List[ToolInfo]
    total: int
    categories: List[str]


class ToolInvocationRequest(BaseModel):
    """Request body for tool invocation."""

    parameters: Dict[str, Any] = Field(default_factory=dict)


class ToolInvocationResponse(BaseModel):
    """Response for tool invocation."""

    tool: str
    success: bool
    result: Any
    latency_ms: int
    error: Optional[str] = None


class OllamaStatusResponse(BaseModel):
    """Response for Ollama connectivity check."""

    connected: bool
    error: Optional[str] = None
    models: List[str] = []


def get_tool_category(tool) -> str:
    """Determine the service category for a tool."""
    tool_name = tool.name.lower()

    if hasattr(tool, "category"):
        return tool.category
    if any(kw in tool_name for kw in ["user", "item", "cart", "order", "note", "room"]):
        return "cloudapp"
    if any(kw in tool_name for kw in ["pet", "employee", "schedule", "customer"]):
        return "petstore"
    if any(kw in tool_name for kw in ["vehicle", "car", "make", "model"]):
        return "vehicles"
    if any(kw in tool_name for kw in ["segment", "predict", "ml", "diagnostic"]):
        return "ml"
    if any(kw in tool_name for kw in ["proxy", "http", "request"]):
        return "proxy"
    return "utility"


def extract_parameters_from_tool(tool) -> List[ToolParameter]:
    """Extract parameter schema from a LangChain tool."""
    parameters = []

    try:
        if hasattr(tool, "args_schema") and tool.args_schema is not None:
            schema = tool.args_schema
            if hasattr(schema, "model_fields"):
                for field_name, field_info in schema.model_fields.items():
                    param_type = "string"
                    if hasattr(field_info, "annotation"):
                        annotation = field_info.annotation
                        if annotation == int:
                            param_type = "integer"
                        elif annotation == float:
                            param_type = "number"
                        elif annotation == bool:
                            param_type = "boolean"
                        elif annotation == list or (
                            hasattr(annotation, "__origin__") and annotation.__origin__ == list
                        ):
                            param_type = "array"
                        elif annotation == dict or (
                            hasattr(annotation, "__origin__") and annotation.__origin__ == dict
                        ):
                            param_type = "object"

                    parameters.append(
                        ToolParameter(
                            name=field_name,
                            type=param_type,
                            description=field_info.description or f"Parameter: {field_name}",
                            required=field_info.is_required() if hasattr(field_info, "is_required") else True,
                            default=field_info.default if field_info.default is not None else None,
                        )
                    )
                return parameters

            if hasattr(schema, "__fields__"):
                for field_name, field in schema.__fields__.items():
                    param_type = "string"
                    if field.outer_type_ == int:
                        param_type = "integer"
                    elif field.outer_type_ == float:
                        param_type = "number"
                    elif field.outer_type_ == bool:
                        param_type = "boolean"

                    parameters.append(
                        ToolParameter(
                            name=field_name,
                            type=param_type,
                            description=field.field_info.description or f"Parameter: {field_name}",
                            required=field.required,
                            default=field.default if field.default is not None else None,
                        )
                    )
                return parameters

        func = tool.func if hasattr(tool, "func") else (tool._run if hasattr(tool, "_run") else None)
        if func is not None:
            sig = inspect.signature(func)
            for param_name, param in sig.parameters.items():
                if param_name in ["self", "cls", "run_manager", "kwargs", "args"]:
                    continue

                param_type = "string"
                if param.annotation != inspect.Parameter.empty:
                    if param.annotation == int:
                        param_type = "integer"
                    elif param.annotation == float:
                        param_type = "number"
                    elif param.annotation == bool:
                        param_type = "boolean"
                    elif param.annotation == list:
                        param_type = "array"
                    elif param.annotation == dict:
                        param_type = "object"

                default_value = None if param.default == inspect.Parameter.empty else param.default
                required = param.default == inspect.Parameter.empty

                parameters.append(
                    ToolParameter(
                        name=param_name,
                        type=param_type,
                        description=f"Parameter: {param_name}",
                        required=required,
                        default=default_value,
                    )
                )
    except Exception:
        return []

    return parameters


def generate_examples(tool) -> List[str]:
    """Generate simple usage examples for a tool."""
    example = f"{tool.name}("
    param_strs = []
    for param in extract_parameters_from_tool(tool)[:3]:
        if param.type == "string":
            param_strs.append(f'{param.name}="example"')
        elif param.type == "integer":
            param_strs.append(f"{param.name}=1")
        elif param.type == "number":
            param_strs.append(f"{param.name}=1.0")
        elif param.type == "boolean":
            param_strs.append(f"{param.name}=True")

    return [example + ", ".join(param_strs) + ")"]


def tool_to_info(tool) -> ToolInfo:
    """Convert a LangChain tool into the API-facing metadata schema."""
    return ToolInfo(
        name=tool.name,
        description=tool.description or f"Tool: {tool.name}",
        category=get_tool_category(tool),
        parameters=extract_parameters_from_tool(tool),
        examples=generate_examples(tool),
    )
