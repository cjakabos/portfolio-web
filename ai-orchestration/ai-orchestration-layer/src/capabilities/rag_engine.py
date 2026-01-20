# backend/ai-orchestration-layer/src/capabilities/rag_engine.py

"""
RAG Engine with Thread-Safe Initialization - FIXED
ISSUE #4 FIX: Thread-safe initialization using asyncio.Lock
Prevents race conditions when multiple concurrent requests initialize RAG
Tracks capabilities used for observability metrics
"""

import asyncio
from typing import Dict, Any, List, Optional
from langchain_chroma import Chroma
from langchain_community.embeddings import OllamaEmbeddings
from langchain.schema import Document
from langchain_core.messages import HumanMessage, SystemMessage

from capabilities.base_capability import BaseCapability, CapabilityError, CapabilityStatus
from core.config import get_config
from core.llm_manager import get_llm
from core.state import UnifiedState


class RAGEngine(BaseCapability):
    """
    Advanced RAG System with thread-safe initialization
    Handles document retrieval, semantic search, and answer generation
    
    FIXED: Multiple concurrent requests can safely initialize the engine
    """
    
    # Class-level initialization lock and state (shared across all instances)
    _initialization_lock = asyncio.Lock()
    _vectorstore = None
    _embeddings = None
    _initialized = False
    
    def __init__(self):
        """Initialize RAG engine"""
        super().__init__(capability_name="rag_engine")
        
        self.config = get_config()
        
        # Use class-level shared resources (will be initialized once)
        # This prevents multiple instances from re-initializing
    
    async def _ensure_initialized(self):
        """
        Thread-safe initialization of RAG components
        ISSUE #4 FIX: Uses asyncio.Lock to prevent race conditions
        """
        # Fast path: if already initialized, return immediately
        if RAGEngine._initialized:
            return
        
        # Acquire lock for initialization
        async with RAGEngine._initialization_lock:
            # Double-check after acquiring lock (another coroutine might have initialized)
            if RAGEngine._initialized:
                return
            
            try:
                self.logger.info("rag_initialization_started", {
                    "persist_directory": self.config.rag.persist_directory,
                    "collection": self.config.rag.collection_name
                })
                
                # Initialize embeddings (class-level, shared)
                RAGEngine._embeddings = OllamaEmbeddings(
                    model=self.config.rag.embedding_model,
                    base_url=self.config.llm.base_url
                )
                
                # Try to load existing vectorstore
                try:
                    RAGEngine._vectorstore = Chroma(
                        persist_directory=self.config.rag.persist_directory,
                        embedding_function=RAGEngine._embeddings,
                        collection_name=self.config.rag.collection_name
                    )
                    
                    # Check if vectorstore is empty
                    collection = RAGEngine._vectorstore._collection
                    if collection.count() == 0:
                        self.logger.warning("rag_vectorstore_empty", {
                            "action": "initializing_with_samples"
                        })
                        await self._initialize_with_samples()
                    else:
                        self.logger.info("rag_vectorstore_loaded", {
                            "document_count": collection.count()
                        })
                
                except Exception as load_error:
                    # Vectorstore doesn't exist, create with samples
                    self.logger.warning("rag_vectorstore_not_found", {
                        "error": str(load_error),
                        "action": "creating_new"
                    })
                    await self._initialize_with_samples()
                
                RAGEngine._initialized = True
                
                self.logger.info("rag_initialization_completed", {
                    "status": "success",
                    "thread_safe": True
                })
                
            except Exception as e:
                self.logger.error("rag_vectorstore_init_failed", 
                                {"error": str(e)}, error=e)
                raise CapabilityError(
                    message=f"Failed to initialize vector store: {str(e)}",
                    capability_name=self.capability_name,
                    error_code="RAG_INIT_ERROR",
                    recoverable=False,
                    original_error=e
                )
    
    async def _initialize_with_samples(self) -> None:
        """Initialize vector store with sample documents"""
        sample_docs = self._get_sample_documents()
        
        # Create vectorstore with documents
        RAGEngine._vectorstore = Chroma.from_documents(
            documents=sample_docs,
            embedding=RAGEngine._embeddings,
            persist_directory=self.config.rag.persist_directory,
            collection_name=self.config.rag.collection_name
        )
        
        # Persist to disk
        RAGEngine._vectorstore.persist()
        
        self.logger.info("rag_vectorstore_initialized", {
            "sample_document_count": len(sample_docs),
            "persist_directory": self.config.rag.persist_directory
        })
    
    def _get_sample_documents(self) -> List[Document]:
        """Get sample documents for initialization"""
        return [
            Document(
                page_content="Customer retention strategies include loyalty programs, personalized communication, and exclusive rewards. Focus on building long-term relationships through consistent engagement.",
                metadata={"user_id": 1, "type": "note", "id": 1, "category": "strategy"}
            ),
            Document(
                page_content="Q4 sales analysis shows 15% growth in online orders. Key drivers: mobile app adoption and expanded delivery zones. Recommend increasing digital marketing spend.",
                metadata={"user_id": 1, "type": "note", "id": 2, "category": "analysis"}
            ),
            Document(
                page_content="Pet grooming best practices: Regular brushing, nail trimming every 2-3 weeks, ear cleaning weekly. Dogs with longer coats need professional grooming monthly.",
                metadata={"user_id": 2, "type": "note", "id": 3, "category": "pets"}
            ),
            Document(
                page_content="Vehicle maintenance schedule: Oil change every 5,000 miles, tire rotation every 7,500 miles, brake inspection annually. Premium vehicles may require synthetic oil.",
                metadata={"user_id": 3, "type": "note", "id": 4, "category": "vehicles"}
            ),
            Document(
                page_content="Shopping cart optimization: Reduce abandonment by offering guest checkout, displaying security badges, and showing shipping costs early in the process.",
                metadata={"user_id": 1, "type": "note", "id": 5, "category": "ecommerce"}
            )
        ]
    
    async def _execute_internal(self, state: UnifiedState) -> Dict[str, Any]:
        """
        Internal execution logic - performs RAG query
        
        Args:
            state: Current unified state
        
        Returns:
            RAG query results with retrieved context
        """
        # Track RAG capabilities usage
        if "capabilities_used" not in state:
            state["capabilities_used"] = []
        state["capabilities_used"].extend(["RAG", "Vector DB", "LLM Gen"])
        
        # Ensure initialized (thread-safe)
        await self._ensure_initialized()

        if not RAGEngine._vectorstore:
            raise CapabilityError(
                message="Vector store not initialized",
                capability_name=self.capability_name,
                error_code="RAG_VECTORSTORE_NOT_INITIALIZED",
                recoverable=True
            )

        query = state["input_data"]
        user_id = state.get("user_id")
        
        try:
            # Retrieve relevant documents
            retriever = RAGEngine._vectorstore.as_retriever(
                search_kwargs={
                    "k": self.config.rag.search_k,
                    "filter": {"user_id": user_id} if user_id else None
                }
            )
            
            docs = await retriever.ainvoke(query)
            
            if not docs:
                return {
                    "result": "I couldn't find any relevant information in your documents. Try rephrasing your question or adding more context.",
                    "sources": [],
                    "context_used": False,
                    "status": "no_results"
                }
            
            # Format context from retrieved documents
            context = "\n\n".join([
                f"Document {i+1}:\n{doc.page_content}"
                for i, doc in enumerate(docs)
            ])
            
            # Generate response using LLM with context
            llm = get_llm()
            
            messages = [
                SystemMessage(content="""You are a helpful assistant that answers questions based on the provided context.
                
Rules:
1. Only use information from the provided context
2. If the context doesn't contain relevant information, say so
3. Be concise and direct in your answers
4. Cite which document(s) you're referencing when relevant"""),
                HumanMessage(content=f"""Context:
{context}

Question: {query}

Answer based on the context above:""")
            ]
            
            response = await llm.ainvoke(messages)
            
            # Extract content
            if hasattr(response, 'content'):
                answer = response.content
            else:
                answer = str(response)
            
            return {
                "result": answer,
                "sources": [
                    {
                        "content": doc.page_content[:200] + "...",
                        "metadata": doc.metadata
                    }
                    for doc in docs
                ],
                "context_used": True,
                "documents_retrieved": len(docs),
                "status": "success"
            }
            
        except Exception as e:
            self.logger.error("rag_query_failed", {
                "query": query,
                "error": str(e)
            }, error=e)
            
            raise CapabilityError(
                message=f"RAG query failed: {str(e)}",
                capability_name=self.capability_name,
                error_code="RAG_QUERY_ERROR",
                recoverable=True,
                original_error=e
            )
    
    async def _execute_fallback(self, state: UnifiedState) -> Dict[str, Any]:
        """Fallback when RAG query fails"""
        return {
            "result": "I'm having trouble searching through your documents right now. Please try again in a moment.",
            "sources": [],
            "context_used": False,
            "status": "fallback"
        }
    
    async def add_documents(
        self,
        documents: List[Dict[str, Any]],
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Add documents to vector store (thread-safe)
        
        Args:
            documents: List of documents with 'content' and optional 'metadata'
            user_id: User ID to associate with documents
        
        Returns:
            Result with document IDs
        """
        # Ensure initialized
        await self._ensure_initialized()
        
        try:
            # Convert to Document objects
            docs = []
            for doc in documents:
                metadata = doc.get("metadata", {})
                if user_id:
                    metadata["user_id"] = user_id
                
                docs.append(Document(
                    page_content=doc["content"],
                    metadata=metadata
                ))
            
            # Add to vectorstore
            ids = RAGEngine._vectorstore.add_documents(docs)
            
            # Persist changes
            RAGEngine._vectorstore.persist()
            
            self.logger.info("rag_documents_added", {
                "count": len(docs),
                "user_id": user_id,
                "ids": ids
            })
            
            return {
                "status": "success",
                "documents_added": len(documents),
                "document_ids": ids
            }
            
        except Exception as e:
            self.logger.error("rag_add_documents_failed", {
                "error": str(e),
                "user_id": user_id
            }, error=e)
            raise CapabilityError(
                message=f"Failed to add documents: {str(e)}",
                capability_name=self.capability_name,
                error_code="RAG_ADD_DOCUMENTS_ERROR",
                recoverable=True,
                original_error=e
            )
    
    async def delete_documents(
        self,
        document_ids: Optional[List[str]] = None,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Delete documents from vector store (thread-safe)
        
        Args:
            document_ids: Specific document IDs to delete
            user_id: Delete all documents for this user
        
        Returns:
            Result with deletion count
        """
        # Ensure initialized
        await self._ensure_initialized()
        
        try:
            if document_ids:
                # Delete specific documents
                RAGEngine._vectorstore.delete(ids=document_ids)
                count = len(document_ids)
            elif user_id:
                # Delete by user_id metadata
                RAGEngine._vectorstore.delete(where={"user_id": user_id})
                count = "all for user"
            else:
                raise ValueError("Must provide either document_ids or user_id")
            
            # Persist changes
            RAGEngine._vectorstore.persist()
            
            self.logger.info("rag_documents_deleted", {
                "count": count,
                "user_id": user_id,
                "document_ids": document_ids
            })
            
            return {
                "status": "success",
                "documents_deleted": count
            }
            
        except Exception as e:
            self.logger.error("rag_delete_documents_failed", {
                "error": str(e),
                "user_id": user_id
            }, error=e)
            raise CapabilityError(
                message=f"Failed to delete documents: {str(e)}",
                capability_name=self.capability_name,
                error_code="RAG_DELETE_DOCUMENTS_ERROR",
                recoverable=True,
                original_error=e
            )
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get RAG engine statistics"""
        await self._ensure_initialized()
        
        if not RAGEngine._vectorstore:
            return {"initialized": False}
        
        try:
            collection = RAGEngine._vectorstore._collection
            count = collection.count()
            
            return {
                "initialized": True,
                "document_count": count,
                "collection_name": self.config.rag.collection_name,
                "persist_directory": self.config.rag.persist_directory,
                "embedding_model": self.config.rag.embedding_model
            }
        except Exception as e:
            self.logger.error("rag_get_stats_failed", {"error": str(e)}, error=e)
            return {
                "initialized": True,
                "error": str(e)
            }
