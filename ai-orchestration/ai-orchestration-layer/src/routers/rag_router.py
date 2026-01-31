# ============================================================================
# File: backend/ai-orchestration-layer/src/routers/rag_router.py
# RAG API ROUTER - With Async Upload & Progress Tracking
# ============================================================================
#
# NEW ENDPOINTS:
#   POST   /rag/documents/upload        - Async upload, returns job_id immediately
#   GET    /rag/documents/upload/status/{job_id} - Poll for progress
#   GET    /rag/documents/upload/jobs   - List recent upload jobs
#
# ============================================================================

import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG - Document Intelligence"])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class UploadJobResponse(BaseModel):
    """Response when upload job is created"""
    job_id: str
    filename: str
    status: str
    message: str


class UploadStatusResponse(BaseModel):
    """Response for upload status polling"""
    job_id: str
    filename: str
    status: str  # pending, parsing, embedding, indexing, completed, failed
    progress: int  # 0-100
    message: str
    doc_id: Optional[str] = None
    chunks_created: int = 0
    char_count: int = 0
    word_count: int = 0
    doc_type: str = "unknown"
    error: Optional[str] = None
    created_at: str
    updated_at: str


class DocumentUploadResponse(BaseModel):
    """Response after document upload (legacy sync endpoint)"""
    status: str
    doc_id: str
    filename: str
    doc_type: str
    chunks_created: int
    char_count: int
    word_count: int
    message: str


class DocumentInfoResponse(BaseModel):
    """Document information"""
    doc_id: str
    filename: str
    doc_type: str
    chunk_count: int
    char_count: int
    word_count: int
    user_id: Optional[int] = None
    created_at: str


class DocumentListResponse(BaseModel):
    """Response for document listing"""
    documents: List[DocumentInfoResponse]
    total: int
    user_id: Optional[int] = None


class QueryRequest(BaseModel):
    """Request for RAG query"""
    query: str = Field(..., min_length=1, description="The question to ask")
    user_id: Optional[int] = Field(None, description="Filter to specific user's documents")
    top_k: int = Field(5, ge=1, le=20, description="Number of chunks to retrieve")
    generate_answer: bool = Field(True, description="Whether to generate an LLM answer")


class SourceInfo(BaseModel):
    """Information about a source document chunk"""
    content: str
    doc_id: Optional[str] = None
    filename: Optional[str] = None
    chunk_index: Optional[int] = None
    doc_type: Optional[str] = None
    similarity_score: Optional[float] = None


class QueryResponse(BaseModel):
    """Response for RAG query"""
    answer: str
    sources: List[SourceInfo]
    query: str
    documents_searched: int
    chunks_retrieved: int = 0
    confidence: float


class RAGStatsResponse(BaseModel):
    """RAG system statistics"""
    initialized: bool
    total_documents: int
    total_chunks: int
    documents_by_type: Dict[str, int]
    persist_directory: str
    collection_name: str
    embedding_model: str


class DeleteResponse(BaseModel):
    """Response for document deletion"""
    status: str
    doc_id: str
    deleted: bool
    message: str


class UserDeleteResponse(BaseModel):
    """Response for user documents deletion"""
    status: str
    user_id: int
    documents_deleted: int
    message: str


# ============================================================================
# CONFIGURATION
# ============================================================================

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".csv"}


def _validate_file(file: UploadFile) -> str:
    """Validate uploaded file and return extension."""
    filename = file.filename or "unknown"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    return ext


# ============================================================================
# LAZY IMPORTS
# ============================================================================

def _get_parser():
    from capabilities.document_parser import get_document_parser
    return get_document_parser()


def _get_engine():
    from capabilities.rag_engine import get_rag_engine
    return get_rag_engine()


def _get_job_manager():
    from capabilities.upload_job_manager import get_job_manager
    return get_job_manager()


# ============================================================================
# BACKGROUND PROCESSING TASK
# ============================================================================

async def process_upload_job(
    job_id: str,
    filename: str,
    content: bytes,
    user_id: Optional[int],
    extra_metadata: Dict[str, Any]
):
    """
    Background task to process document upload.
    Updates job status as it progresses through stages.
    """
    job_manager = _get_job_manager()

    try:
        # Stage 1: Parsing (0-30%)
        await job_manager.update_job(
            job_id,
            status="parsing",
            progress=10,
            message=f"Parsing {filename}..."
        )

        parser = _get_parser()
        parsed = await parser.parse(
            filename=filename,
            content=content,
            user_id=user_id,
            extra_metadata=extra_metadata
        )

        if not parsed.chunks:
            await job_manager.fail_job(job_id, "Could not extract any text from the document")
            return

        await job_manager.update_job(
            job_id,
            progress=30,
            message=f"Parsed {len(parsed.chunks)} chunks, generating embeddings..."
        )

        # Stage 2: Embedding (30-80%)
        await job_manager.update_job(
            job_id,
            status="embedding",
            progress=35,
            message=f"Generating embeddings for {len(parsed.chunks)} chunks (this may take a while)..."
        )

        engine = _get_engine()

        chunks_data = [
            {"content": chunk.content, "metadata": chunk.metadata}
            for chunk in parsed.chunks
        ]

        # Simulate progress during embedding (actual progress would require
        # modifying the embedding function to report progress)
        total_chunks = len(chunks_data)

        await job_manager.update_job(
            job_id,
            progress=50,
            message=f"Embedding {total_chunks} chunks... (0/{total_chunks})"
        )

        # Stage 3: Indexing (80-100%)
        await job_manager.update_job(
            job_id,
            status="indexing",
            progress=80,
            message="Adding to vector database..."
        )

        await engine.add_document(
            doc_id=parsed.doc_id,
            chunks=chunks_data,
            metadata={
                "filename": parsed.filename,
                "doc_type": parsed.doc_type.value,
                "page_count": parsed.page_count,
                "char_count": parsed.char_count,
                "word_count": parsed.word_count,
                "user_id": user_id,
            }
        )

        # Complete!
        await job_manager.complete_job(
            job_id=job_id,
            doc_id=parsed.doc_id,
            chunks_created=len(parsed.chunks),
            char_count=parsed.char_count,
            word_count=parsed.word_count,
            doc_type=parsed.doc_type.value
        )

        logger.info(f"✅ Upload job {job_id} completed: {filename} ({len(parsed.chunks)} chunks)")

    except Exception as e:
        logger.error(f"❌ Upload job {job_id} failed: {e}", exc_info=True)
        await job_manager.fail_job(job_id, str(e))


# ============================================================================
# ASYNC UPLOAD ENDPOINTS (NEW!)
# ============================================================================

@router.post("/documents/upload", response_model=UploadJobResponse)
async def upload_document_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Document file to upload"),
    user_id: Optional[int] = Form(None, description="User ID to associate with document"),
    tags: Optional[str] = Form(None, description="Comma-separated tags"),
    category: Optional[str] = Form(None, description="Document category")
):
    """
    Upload a document for RAG indexing (async).

    Returns immediately with a job_id. Poll `/upload/status/{job_id}` for progress.

    **Processing stages:**
    1. `parsing` - Extracting text from document
    2. `embedding` - Generating vector embeddings (slowest step)
    3. `indexing` - Adding to vector database
    4. `completed` - Ready for queries
    """
    _validate_file(file)

    try:
        content = await file.read()

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)} MB"
            )

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        # Parse tags
        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        extra_metadata: Dict[str, Any] = {}
        if tag_list:
            extra_metadata["tags"] = tag_list
        if category:
            extra_metadata["category"] = category

        # Create job
        job_manager = _get_job_manager()
        job = await job_manager.create_job(file.filename or "uploaded_document")

        # Start background processing
        background_tasks.add_task(
            process_upload_job,
            job.job_id,
            file.filename or "uploaded_document",
            content,
            user_id,
            extra_metadata
        )

        return UploadJobResponse(
            job_id=job.job_id,
            filename=job.filename,
            status=job.status.value,
            message="Upload received. Processing started in background."
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload initiation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start upload: {str(e)}")


@router.get("/documents/upload/status/{job_id}", response_model=UploadStatusResponse)
async def get_upload_status(job_id: str):
    """
    Get the status of an upload job.

    Poll this endpoint to track upload progress.
    Recommended polling interval: 2-3 seconds.
    """
    job_manager = _get_job_manager()
    job = await job_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return UploadStatusResponse(**job.to_dict())


@router.get("/documents/upload/jobs")
async def list_upload_jobs(limit: int = Query(20, ge=1, le=100)):
    """List recent upload jobs."""
    job_manager = _get_job_manager()
    jobs = await job_manager.list_jobs(limit=limit)
    return {"jobs": jobs, "total": len(jobs)}


# ============================================================================
# DOCUMENT LISTING ENDPOINTS
# ============================================================================

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum documents to return")
):
    """List all documents in the RAG system."""
    try:
        engine = _get_engine()
        documents = await engine.list_documents(user_id=user_id, limit=limit)

        return DocumentListResponse(
            documents=[DocumentInfoResponse(**doc) for doc in documents],
            total=len(documents),
            user_id=user_id
        )
    except Exception as e:
        logger.error(f"Failed to list documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")


@router.get("/documents/{doc_id}", response_model=DocumentInfoResponse)
async def get_document(doc_id: str):
    """Get information about a specific document."""
    try:
        engine = _get_engine()
        doc_info = await engine.get_document_info(doc_id)

        if not doc_info:
            raise HTTPException(status_code=404, detail=f"Document not found: {doc_id}")

        return DocumentInfoResponse(**doc_info)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get document {doc_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get document: {str(e)}")


# ============================================================================
# DOCUMENT DELETION ENDPOINTS
# ============================================================================

@router.delete("/documents/{doc_id}", response_model=DeleteResponse)
async def delete_document(doc_id: str):
    """Delete a document and all its chunks."""
    try:
        engine = _get_engine()
        result = await engine.delete_document(doc_id)

        return DeleteResponse(
            status="success",
            doc_id=doc_id,
            deleted=result.get("deleted", False),
            message=f"Document '{doc_id}' deleted" if result.get("deleted") else f"Document '{doc_id}' not found"
        )
    except Exception as e:
        logger.error(f"Failed to delete document {doc_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@router.delete("/documents/user/{user_id}", response_model=UserDeleteResponse)
async def delete_user_documents(user_id: int):
    """Delete all documents belonging to a specific user."""
    try:
        engine = _get_engine()
        result = await engine.delete_user_documents(user_id)

        return UserDeleteResponse(
            status="success",
            user_id=user_id,
            documents_deleted=result.get("documents_deleted", 0),
            message=f"Deleted {result.get('documents_deleted', 0)} documents for user {user_id}"
        )
    except Exception as e:
        logger.error(f"Failed to delete documents for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete user documents: {str(e)}")


# ============================================================================
# QUERY ENDPOINT
# ============================================================================

@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    """Query the RAG system with a natural language question."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        engine = _get_engine()
        result = await engine.query(
            query=request.query.strip(),
            user_id=request.user_id,
            top_k=request.top_k,
            generate_answer=request.generate_answer
        )

        return QueryResponse(
            answer=result.answer,
            sources=[SourceInfo(
                content=s.get("content", ""),
                doc_id=s.get("doc_id"),
                filename=s.get("filename"),
                chunk_index=s.get("chunk_index"),
                doc_type=s.get("doc_type"),
                similarity_score=s.get("similarity_score")
            ) for s in result.sources],
            query=result.query,
            documents_searched=result.documents_searched,
            chunks_retrieved=result.chunks_retrieved,
            confidence=result.confidence
        )
    except Exception as e:
        logger.error(f"RAG query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


# ============================================================================
# STATS AND HEALTH ENDPOINTS
# ============================================================================

@router.get("/stats", response_model=RAGStatsResponse)
async def get_rag_stats():
    """Get RAG system statistics."""
    try:
        engine = _get_engine()
        stats = await engine.get_stats()
        return RAGStatsResponse(**stats)
    except Exception as e:
        logger.error(f"Failed to get RAG stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.get("/health")
async def rag_health_check():
    """Check health of the RAG system."""
    try:
        engine = _get_engine()
        stats = await engine.get_stats()

        return {
            "status": "healthy" if stats.get("initialized") else "initializing",
            "service": "rag",
            "initialized": stats.get("initialized", False),
            "total_documents": stats.get("total_documents", 0),
            "total_chunks": stats.get("total_chunks", 0),
            "embedding_model": stats.get("embedding_model", "unknown"),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "rag",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }


# ============================================================================
# INITIALIZATION
# ============================================================================

async def initialize_rag():
    """Initialize RAG system on startup."""
    try:
        from capabilities.rag_engine import initialize_rag_engine
        await initialize_rag_engine()
        logger.info("✅ RAG system initialized")
    except Exception as e:
        logger.warning(f"⚠️ RAG initialization warning: {e}")