"""Real RAG routes/auth for gateway tests; corpus I/O is deterministic."""
from fastapi import FastAPI

from routers import rag_router
from core.config import get_config

get_config()


class GatewayCorpus:
    async def list_documents(self, **kwargs):
        return []

    async def delete_document(self, doc_id):
        return {"deleted": True}


rag_router._get_engine = GatewayCorpus
app = FastAPI()
app.include_router(rag_router.router)


@app.get("/health")
def readiness():
    return {"status": "healthy"}
