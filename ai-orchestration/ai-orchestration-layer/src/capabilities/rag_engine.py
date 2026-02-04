# backend/ai-orchestration-layer/src/capabilities/rag_engine.py
# FIXED VERSION - Uses LLMManager for embeddings (correct Ollama URL)
# UPDATED: Embeddings now respect dynamic model selection

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, field, asdict
from pathlib import Path

# Updated LangChain imports (new packages)
try:
    from langchain_chroma import Chroma
except ImportError:
    # Fallback to old import if new package not installed
    from langchain_community.vectorstores import Chroma

try:
    from langchain_ollama import OllamaEmbeddings
except ImportError:
    # Fallback to old import if new package not installed
    from langchain_community.embeddings import OllamaEmbeddings

from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage

# Framework imports
from capabilities.base_capability import BaseCapability, CapabilityError
from core.llm_manager import get_llm_manager  # FIXED: Use LLMManager
from core.state import UnifiedState

logger = logging.getLogger(__name__)


@dataclass
class DocumentInfo:
    """Information about a stored document"""
    doc_id: str
    filename: str
    doc_type: str
    chunk_count: int
    char_count: int
    word_count: int
    user_id: Optional[int]
    created_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RAGQueryResult:
    """Standardized return type for RAG queries"""
    answer: str
    sources: List[Dict[str, Any]]
    query: str
    documents_searched: int  # Now represents actual unique documents
    chunks_retrieved: int    # NEW: Number of chunks retrieved
    confidence: float        # NEW: Actually calculated from similarity scores


class RAGEngine(BaseCapability):
    """
    Advanced RAG System with thread-safe initialization and persistent document registry.

    FIXES APPLIED:
    1. Document registry is now persisted to disk
    2. Confidence is calculated from actual similarity scores
    3. documents_searched now shows unique documents, not top_k
    4. Added proper initialize() method
    5. FIXED: Now uses LLMManager for embeddings (correct Ollama URL)
    """

    # Class-level shared resources (singleton pattern)
    _vectorstore: Optional[Chroma] = None
    _embeddings: Optional[OllamaEmbeddings] = None
    _initialized: bool = False
    _initialization_lock: asyncio.Lock = None
    _current_embedding_model: Optional[str] = None  # Track which model we initialized with

    # Document tracking registry - NOW LOADED FROM DISK
    _document_registry: Dict[str, DocumentInfo] = {}
    _registry_file: Optional[Path] = None

    def __init__(self):
        """Initialize RAG engine via BaseCapability."""
        super().__init__(capability_name="rag_engine")
        self.logger = logging.getLogger(__name__)

        # Configuration - persist directory and collection from env
        self.persist_directory = os.getenv("CHROMA_PERSIST_DIR", "/data/chroma")
        self.collection_name = os.getenv("CHROMA_COLLECTION", "user_documents")
        self.search_k = int(os.getenv("RAG_SEARCH_K", "5"))

        # FIXED: Get LLMManager instance for embeddings
        self.llm_manager = get_llm_manager()

        # FIX: Set registry file path for persistence
        RAGEngine._registry_file = Path(self.persist_directory) / "document_registry.json"

        # Initialize lock
        if RAGEngine._initialization_lock is None:
            RAGEngine._initialization_lock = asyncio.Lock()

    def _save_registry(self):
        """Persist document registry to disk."""
        if RAGEngine._registry_file is None:
            return

        try:
            registry_data = {
                doc_id: asdict(info)
                for doc_id, info in RAGEngine._document_registry.items()
            }
            RAGEngine._registry_file.parent.mkdir(parents=True, exist_ok=True)
            RAGEngine._registry_file.write_text(json.dumps(registry_data, indent=2))
            self.logger.debug(f"Registry saved: {len(registry_data)} documents")
        except Exception as e:
            self.logger.error(f"Failed to save registry: {e}")

    def _load_registry(self):
        """Load document registry from disk."""
        if RAGEngine._registry_file is None or not RAGEngine._registry_file.exists():
            self.logger.info("No existing registry found, starting fresh")
            return

        try:
            registry_data = json.loads(RAGEngine._registry_file.read_text())
            RAGEngine._document_registry = {
                doc_id: DocumentInfo(**data)
                for doc_id, data in registry_data.items()
            }
            self.logger.info(f"Registry loaded: {len(RAGEngine._document_registry)} documents")
        except Exception as e:
            self.logger.error(f"Failed to load registry: {e}")
            RAGEngine._document_registry = {}

    async def initialize(self):
        """
        Public initialization method - called by rag_router.py.
        This was missing and causing the warning!
        """
        await self._ensure_initialized()

    async def _ensure_initialized(self):
        """Thread-safe initialization."""
        # FIXED: Check if embedding model changed (supports dynamic model switching)
        current_model = self.llm_manager.embedding_model
        model_changed = (
            RAGEngine._initialized and
            RAGEngine._current_embedding_model != current_model
        )

        if model_changed:
            self.logger.info(f"Embedding model changed from '{RAGEngine._current_embedding_model}' to '{current_model}', reinitializing...")
            RAGEngine._initialized = False

        if RAGEngine._initialized:
            return

        async with RAGEngine._initialization_lock:
            if RAGEngine._initialized:
                return

            try:
                self.logger.info("rag_initialization_started", extra={
                    "persist_directory": self.persist_directory,
                    "embedding_model": current_model,
                    "ollama_url": self.llm_manager.base_url  # FIXED: Log the URL being used
                })

                os.makedirs(self.persist_directory, exist_ok=True)

                # FIXED: Use LLMManager for embeddings - this uses the correct OLLAMA_URL!
                RAGEngine._embeddings = self.llm_manager.get_embeddings(
                    cache_key="rag_embeddings"
                )
                RAGEngine._current_embedding_model = current_model

                RAGEngine._vectorstore = Chroma(
                    persist_directory=self.persist_directory,
                    embedding_function=RAGEngine._embeddings,
                    collection_name=self.collection_name
                )

                # FIX: Load persisted registry on startup
                self._load_registry()

                # FIX: Sync registry with ChromaDB (handle orphaned docs)
                await self._sync_registry_with_vectorstore()

                RAGEngine._initialized = True
                self.logger.info(f"rag_initialization_completed - using {current_model} at {self.llm_manager.base_url}")

            except Exception as e:
                self.logger.error(f"RAG Init Failed: {e}")
                raise CapabilityError(f"RAG Init Failed: {str(e)}", self.capability_name)

    async def _sync_registry_with_vectorstore(self):
        """
        FIX: Sync registry with actual ChromaDB state.
        Handles cases where registry is out of sync with vectorstore.
        """
        if not RAGEngine._vectorstore:
            return

        try:
            # Get all unique doc_ids from ChromaDB
            collection = RAGEngine._vectorstore._collection
            all_metadata = collection.get(include=["metadatas"])

            if not all_metadata or not all_metadata.get("metadatas"):
                return

            # Extract unique doc_ids and their chunk counts from ChromaDB
            chroma_docs: Dict[str, Dict[str, Any]] = {}
            for meta in all_metadata["metadatas"]:
                if meta and "doc_id" in meta:
                    doc_id = meta["doc_id"]
                    if doc_id not in chroma_docs:
                        chroma_docs[doc_id] = {
                            "chunk_count": 0,
                            "filename": meta.get("filename", "unknown"),
                            "doc_type": meta.get("doc_type", "unknown"),
                            "user_id": meta.get("user_id"),
                        }
                    chroma_docs[doc_id]["chunk_count"] += 1

            # Add any docs in ChromaDB but missing from registry
            for doc_id, info in chroma_docs.items():
                if doc_id not in RAGEngine._document_registry:
                    self.logger.warning(f"Found orphaned doc in ChromaDB: {doc_id}, adding to registry")
                    RAGEngine._document_registry[doc_id] = DocumentInfo(
                        doc_id=doc_id,
                        filename=info["filename"],
                        doc_type=info["doc_type"],
                        chunk_count=info["chunk_count"],
                        char_count=0,  # Unknown for recovered docs
                        word_count=0,
                        user_id=info["user_id"],
                        created_at=datetime.utcnow().isoformat() + "Z",
                        metadata={"recovered": True}
                    )

            # Remove registry entries for docs not in ChromaDB
            registry_doc_ids = list(RAGEngine._document_registry.keys())
            for doc_id in registry_doc_ids:
                if doc_id not in chroma_docs:
                    self.logger.warning(f"Removing stale registry entry: {doc_id}")
                    del RAGEngine._document_registry[doc_id]

            self._save_registry()

        except Exception as e:
            self.logger.error(f"Registry sync failed: {e}")

    # =========================================================================
    # ORCHESTRATOR METHODS
    # =========================================================================

    async def _execute_internal(self, state: UnifiedState) -> Dict[str, Any]:
        """Internal execution logic required by BaseCapability."""
        await self._ensure_initialized()

        if "capabilities_used" not in state:
            state["capabilities_used"] = []
        state["capabilities_used"].append("rag_engine")

        query = state.get("input_data") or state.get("query")
        if not query:
            return {"status": "skipped", "reason": "no query provided"}

        user_id = state.get("user_id")

        try:
            result = await self.query(
                query=query,
                user_id=int(user_id) if user_id else None,
                top_k=self.search_k
            )

            state.update("rag_response", result.answer)
            state.update("rag_sources", result.sources)
            state.update("rag_confidence", result.confidence)

            return {
                "result": result.answer,
                "sources": result.sources,
                "confidence": result.confidence,
                "status": "success"
            }

        except Exception as e:
            self.logger.error(f"RAG Internal Exec failed: {e}")
            raise CapabilityError(f"RAG Internal Exec failed: {str(e)}", self.capability_name)

    # =========================================================================
    # DOCUMENT MANAGEMENT
    # =========================================================================

    async def add_document(self, doc_id: str, chunks: List[Dict[str, Any]], metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Add document with Metadata Sanitization."""
        await self._ensure_initialized()
        try:
            documents = []
            for chunk in chunks:
                chunk_meta = chunk.get("metadata", {}).copy()
                chunk_meta["doc_id"] = doc_id

                for k, v in metadata.items():
                    if v is None or k == "raw_text":
                        continue
                    chunk_meta[k] = v if isinstance(v, (str, int, float, bool)) else str(v)

                documents.append(Document(page_content=chunk["content"], metadata=chunk_meta))

            RAGEngine._vectorstore.add_documents(documents)

            RAGEngine._document_registry[doc_id] = DocumentInfo(
                doc_id=doc_id,
                filename=metadata.get("filename", "unknown"),
                doc_type=metadata.get("doc_type", "unknown"),
                chunk_count=len(chunks),
                char_count=metadata.get("char_count", 0),
                word_count=metadata.get("word_count", 0),
                user_id=metadata.get("user_id"),
                created_at=datetime.utcnow().isoformat() + "Z",
                metadata=metadata
            )

            # FIX: Persist registry after adding document
            self._save_registry()

            return {"status": "success", "doc_id": doc_id, "chunks_added": len(chunks)}
        except Exception as e:
            self.logger.error(f"Add document failed: {e}")
            raise CapabilityError(f"Failed to add document: {str(e)}", self.capability_name)

    async def list_documents(self, user_id: Optional[int] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """List documents from registry."""
        await self._ensure_initialized()
        docs = []
        for info in RAGEngine._document_registry.values():
            if user_id is None or info.user_id == user_id:
                docs.append(asdict(info))
            if len(docs) >= limit:
                break
        return docs

    async def get_document_info(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Fetch info for a single document."""
        await self._ensure_initialized()
        info = RAGEngine._document_registry.get(doc_id)
        return asdict(info) if info else None

    async def delete_document(self, doc_id: str) -> Dict[str, Any]:
        """Delete a specific document."""
        await self._ensure_initialized()
        RAGEngine._vectorstore._collection.delete(where={"doc_id": doc_id})
        removed = RAGEngine._document_registry.pop(doc_id, None)

        # Persist registry after deletion
        self._save_registry()

        return {"deleted": removed is not None}

    async def delete_user_documents(self, user_id: int) -> Dict[str, Any]:
        """Delete all documents for a specific user."""
        await self._ensure_initialized()
        RAGEngine._vectorstore.delete(where={"user_id": user_id})

        to_remove = [k for k, v in RAGEngine._document_registry.items() if v.user_id == user_id]
        for k in to_remove:
            del RAGEngine._document_registry[k]

        # FIX: Persist registry after deletion
        self._save_registry()

        return {"status": "success", "user_id": user_id, "documents_deleted": len(to_remove)}

    async def get_stats(self) -> Dict[str, Any]:
        """Get system statistics."""
        await self._ensure_initialized()

        doc_types = {}
        for doc in RAGEngine._document_registry.values():
            doc_types[doc.doc_type] = doc_types.get(doc.doc_type, 0) + 1

        return {
            "initialized": RAGEngine._initialized,
            "total_documents": len(RAGEngine._document_registry),
            "total_chunks": RAGEngine._vectorstore._collection.count() if RAGEngine._vectorstore else 0,
            "documents_by_type": doc_types,
            "persist_directory": self.persist_directory,
            "collection_name": self.collection_name,
            # RAG uses TWO models:
            "embedding_model": self.llm_manager.embedding_model,  # For vector search
            "rag_llm_model": self.llm_manager.rag_model,          # For answer generation
            "ollama_url": self.llm_manager.base_url
        }

    # =========================================================================
    # QUERY OPERATIONS - FIXED!
    # =========================================================================

    async def query(
        self,
        query: str,
        user_id: Optional[int] = None,
        top_k: int = 5,
        generate_answer: bool = True
    ) -> RAGQueryResult:
        """
        Public query method with ACTUAL confidence calculation.

        FIXES:
        - Confidence is calculated from similarity scores (not hardcoded 0.85)
        - documents_searched is unique documents, not top_k
        - Added chunks_retrieved field for clarity
        """
        await self._ensure_initialized()

        search_filter = {"user_id": user_id} if user_id else None

        # FIX: Use similarity_search_with_score to get actual confidence
        docs_with_scores = RAGEngine._vectorstore.similarity_search_with_score(
            query,
            k=top_k,
            filter=search_filter
        )

        if not docs_with_scores:
            return RAGQueryResult(
                answer="No relevant documents found.",
                sources=[],
                query=query,
                documents_searched=0,
                chunks_retrieved=0,
                confidence=0.0
            )

        # FIX: Calculate actual confidence from similarity scores
        # ChromaDB returns L2 distance - lower is better
        # Convert to similarity score: similarity = 1 / (1 + distance)
        scores = [1 / (1 + score) for _, score in docs_with_scores]
        avg_confidence = sum(scores) / len(scores) if scores else 0.0

        # FIX: Count unique documents (not just chunks)
        unique_doc_ids = set()
        for doc, _ in docs_with_scores:
            doc_id = doc.metadata.get("doc_id")
            if doc_id:
                unique_doc_ids.add(doc_id)

        # Extract just the documents
        docs = [doc for doc, _ in docs_with_scores]

        # Context formatting
        context = "\n\n".join([f"Source {i+1}: {d.page_content}" for i, d in enumerate(docs)])

        answer = "Answer generation disabled."
        if generate_answer:
            try:
                # Check if we have a valid RAG model before trying to generate
                rag_model = self.llm_manager.rag_model

                # Validate the model exists by checking available models
                models, connected, _ = await self.llm_manager.fetch_available_models()

                if not connected:
                    self.logger.warning("Cannot generate answer: Ollama not connected")
                    answer = "Retrieved relevant documents but cannot generate answer: Ollama not connected."
                elif not models:
                    self.logger.warning("Cannot generate answer: No models available")
                    answer = "Retrieved relevant documents but cannot generate answer: No models installed in Ollama."
                else:
                    # Check if the configured RAG model exists and is not an embedding model
                    available_model_names = [m.name for m in models]
                    model_exists = any(
                        rag_model == m or rag_model.split(":")[0] == m.split(":")[0]
                        for m in available_model_names
                    )
                    is_embedding_model = 'embed' in rag_model.lower()

                    if not model_exists:
                        # Try to find any non-embedding model to use
                        non_embed_models = [m for m in available_model_names if 'embed' not in m.lower()]
                        if non_embed_models:
                            fallback_model = non_embed_models[0]
                            self.logger.info(f"RAG model '{rag_model}' not found, using fallback: {fallback_model}")
                            self.llm_manager.set_rag_model(fallback_model)
                        else:
                            self.logger.warning(f"Cannot generate answer: No chat models available (only embedding models found)")
                            answer = (
                                "Found relevant documents but cannot generate answer.\n\n"
                                "RAG requires two types of models:\n"
                                "• Embedding model (for search) - installed ✓\n"
                                "• Chat/LLM model (for answers) - not installed ✗\n\n"
                                "Please install a chat model using: ollama pull <model-name>\n"
                                "Then refresh this page."
                            )
                            # Return early with documents but no generated answer
                            return RAGQueryResult(
                                answer=answer,
                                sources=[{
                                    "content": d.page_content,
                                    "doc_id": d.metadata.get("doc_id"),
                                    "filename": d.metadata.get("filename"),
                                    "chunk_index": d.metadata.get("chunk_index"),
                                    "doc_type": d.metadata.get("doc_type"),
                                    "similarity_score": scores[i]
                                } for i, d in enumerate(docs)],
                                query=query,
                                documents_searched=len(unique_doc_ids),
                                chunks_retrieved=len(docs),
                                confidence=round(avg_confidence, 3)
                            )
                    elif is_embedding_model:
                        # Current model is an embedding model, try to find a chat model
                        non_embed_models = [m for m in available_model_names if 'embed' not in m.lower()]
                        if non_embed_models:
                            fallback_model = non_embed_models[0]
                            self.logger.info(f"RAG model '{rag_model}' is embedding model, using fallback: {fallback_model}")
                            self.llm_manager.set_rag_model(fallback_model)
                        else:
                            self.logger.warning(f"Cannot generate answer: Only embedding models available")
                            answer = (
                                "Found relevant documents but cannot generate answer.\n\n"
                                "RAG requires two types of models:\n"
                                "• Embedding model (for search) - installed ✓\n"
                                "• Chat/LLM model (for answers) - not installed ✗\n\n"
                                "Please install a chat model using: ollama pull <model-name>\n"
                                "Then refresh this page."
                            )
                            return RAGQueryResult(
                                answer=answer,
                                sources=[{
                                    "content": d.page_content,
                                    "doc_id": d.metadata.get("doc_id"),
                                    "filename": d.metadata.get("filename"),
                                    "chunk_index": d.metadata.get("chunk_index"),
                                    "doc_type": d.metadata.get("doc_type"),
                                    "similarity_score": scores[i]
                                } for i, d in enumerate(docs)],
                                query=query,
                                documents_searched=len(unique_doc_ids),
                                chunks_retrieved=len(docs),
                                confidence=round(avg_confidence, 3)
                            )

                    # Now generate the answer with validated model
                    llm = self.llm_manager.get_rag_llm()
                    messages = [
                        SystemMessage(content="""Answer the user's question based ONLY on the provided context.
Be concise and direct. If the context doesn't contain relevant information, say so clearly.
Do NOT list or cite sources in your answer - sources are displayed separately in the UI."""),
                        HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}")
                    ]
                    response = await llm.ainvoke(messages)
                    answer = response.content if hasattr(response, 'content') else str(response)

            except Exception as e:
                self.logger.error(f"LLM Error: {e}")
                answer = f"Retrieved relevant documents but error generating answer: {str(e)}"

        return RAGQueryResult(
            answer=answer,
            sources=[{
                "content": d.page_content,
                "doc_id": d.metadata.get("doc_id"),
                "filename": d.metadata.get("filename"),
                "chunk_index": d.metadata.get("chunk_index"),
                "doc_type": d.metadata.get("doc_type"),
                "similarity_score": scores[i]  # FIX: Include per-source score
            } for i, d in enumerate(docs)],
            query=query,
            documents_searched=len(unique_doc_ids),  # FIX: Unique documents
            chunks_retrieved=len(docs),              # FIX: Actual chunks retrieved
            confidence=round(avg_confidence, 3)      # FIX: Calculated confidence
        )


# ============================================================================
# SINGLETON & HELPERS
# ============================================================================

_engine_instance = None


def get_rag_engine():
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RAGEngine()
    return _engine_instance


async def initialize_rag_engine():
    """Helper function required by rag_router.py"""
    engine = get_rag_engine()
    await engine.initialize()  # FIX: Now this method exists!
    return engine