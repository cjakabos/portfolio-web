# ============================================================================
# File: backend/ai-orchestration-layer/src/tools/ml_tools.py
# ML PIPELINE TOOLS
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
    logger = logging.getLogger("ml_tools")


@tool
async def get_segmentation(customer_data: str) -> str:
    """
    Get customer segmentation analysis.
    Args:
        customer_data: JSON string of customer data or customer ID
    Returns: JSON string containing segmentation results
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        try:
            payload = json.loads(customer_data)
        except (ValueError, TypeError, KeyError):
            payload = {"data": customer_data}

        response = await client.post("/mlops-segmentation/getMLInfo", json=payload)
        return json.dumps(response)
    except Exception as e:
        logger.error("segmentation_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_predictions(data: str) -> str:
    """
    Get ML predictions for provided data.
    Args:
        data: Input data for prediction (JSON string or plain text)
    Returns: JSON string containing prediction results
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.post("/predictions", json={"input": data})
        return json.dumps(response)
    except Exception as e:
        logger.error("prediction_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def run_diagnostics(system_id: str) -> str:
    """
    Run ML diagnostics on a system.
    Args:
        system_id: ID of the system to run diagnostics on
    Returns: JSON string containing diagnostic results
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.post("/diagnostics", json={"systemId": system_id})
        return json.dumps(response)
    except Exception as e:
        logger.error("diagnostics_failed", {"system_id": system_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_model_info(ml_model_id: str) -> str:
    """
    Get information about a specific ML model.
    Args:
        ml_model_id: ID of the model to get info for
    Returns: JSON string containing model information
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.get(f"/models/{ml_model_id}")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_model_info_failed", {"ml_model_id": ml_model_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def list_models() -> str:
    """
    List all available ML models.
    Returns: JSON string containing list of models
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.get("/models")
        return json.dumps(response)
    except Exception as e:
        logger.error("list_models_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_model_metrics(ml_model_id: str) -> str:
    """
    Get performance metrics for a specific ML model.
    Args:
        ml_model_id: ID of the model to get metrics for
    Returns: JSON string containing model metrics
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.get(f"/models/{ml_model_id}/metrics")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_model_metrics_failed", {"ml_model_id": ml_model_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def batch_predict(data_list: List[str]) -> str:
    """
    Run batch predictions on multiple data items.
    Args:
        data_list: List of input data items for prediction
    Returns: JSON string containing batch prediction results
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.post("/predictions/batch", json={"inputs": data_list})
        return json.dumps(response)
    except Exception as e:
        logger.error("batch_predict_failed", {"count": len(data_list), "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_feature_importance(ml_model_id: str) -> str:
    """
    Get feature importance scores for a model.
    Args:
        ml_model_id: ID of the model
    Returns: JSON string containing feature importance data
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.get(f"/models/{ml_model_id}/feature-importance")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_feature_importance_failed", {"ml_model_id": ml_model_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def explain_prediction(ml_model_id: str, input_data: str) -> str:
    """
    Get explanation for a specific prediction.
    Args:
        ml_model_id: ID of the model
        input_data: Input data that was used for prediction
    Returns: JSON string containing prediction explanation
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        try:
            payload = json.loads(input_data)
        except (ValueError, TypeError, KeyError):
            payload = {"data": input_data}
            
        response = await client.post(f"/models/{ml_model_id}/explain", json=payload)
        return json.dumps(response)
    except Exception as e:
        logger.error("explain_prediction_failed", {"ml_model_id": ml_model_id, "error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


@tool
async def get_ml_health() -> str:
    """
    Get health status of ML services.
    Returns: JSON string containing ML service health status
    """
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.get("/health")
        return json.dumps(response)
    except Exception as e:
        logger.error("get_ml_health_failed", {"error": str(e)}, error=e)
        return json.dumps({"error": str(e)})


# ============================================================================
# HELPER FUNCTIONS (non-tool)
# ============================================================================

async def fetch_models() -> List[Dict[str, Any]]:
    """Direct function to fetch all models"""
    try:
        client = ServiceHTTPClients.get_ml_client()
        response = await client.get("/models")
        if isinstance(response, dict):
            return response.get("models", [])
        return response if isinstance(response, list) else []
    except Exception as e:
        logger.error("fetch_models_failed", {"error": str(e)}, error=e)
        return []


async def fetch_ml_status() -> Optional[Dict[str, Any]]:
    """Direct function to fetch ML service status"""
    try:
        client = ServiceHTTPClients.get_ml_client()
        return await client.get("/health")
    except Exception as e:
        logger.error("fetch_ml_status_failed", {"error": str(e)}, error=e)
        return None


def get_ml_tools():
    """Return all ML tools as a list"""
    return [
        get_segmentation,
        get_predictions,
        run_diagnostics,
        get_model_info,
        list_models,
        get_model_metrics,
        batch_predict,
        get_feature_importance,
        explain_prediction,
        get_ml_health
    ]
