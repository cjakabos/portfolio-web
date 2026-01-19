# backend/ai-orchestration-layer/src/capabilities/rag_engine.py

"""
RAG Engine with Thread-Safe Initialization - FIXED
ISSUE #4 FIX: Thread-safe initialization using asyncio.Lock
Prevents race conditions when multiple concurrent requests initialize RAG
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
                page_content="Product development roadmap focuses on AI integration and mobile experience. Priority features include real-time analytics, automated workflows, and enhanced security.",
                metadata={"user_id": 1, "type": "note", "id": 2, "category": "product"}
            ),
            Document(
                page_content="Q4 strategy emphasizes customer acquisition and market expansion. Key initiatives: digital marketing campaigns, partnership development, and product diversification.",
                metadata={"user_id": 1, "type": "note", "id": 3, "category": "strategy"}
            ),
            Document(
                page_content="Technical architecture uses microservices pattern with event-driven communication. Services include orchestration layer, ML pipeline, RAG system, and agent framework.",
                metadata={"user_id": 1, "type": "note", "id": 4, "category": "technical"}
            ),
            Document(
                page_content="Team structure: Engineering (15), Product (5), Sales (8), Marketing (6). Focus on cross-functional collaboration and agile methodologies.",
                metadata={"user_id": 1, "type": "note", "id": 5, "category": "organization"}
            ),
            Document(
                page_content="Security best practices: regular audits, encryption at rest and in transit, zero-trust architecture, multi-factor authentication, and compliance with SOC 2 standards.",
                metadata={"user_id": 1, "type": "note", "id": 6, "category": "security"}
            ),
            Document(
                page_content="Performance metrics: 99.9% uptime, <200ms API response time, 10M+ requests/day. Infrastructure uses Kubernetes for orchestration and auto-scaling.",
                metadata={"user_id": 1, "type": "note", "id": 7, "category": "technical"}
            ),
            Document(
                page_content="Machine learning pipeline includes data preprocessing, feature engineering, model training with cross-validation, A/B testing, and continuous monitoring.",
                metadata={"user_id": 1, "type": "note", "id": 8, "category": "ml"}
            )
        ]
    
    async def _execute_internal(self, state) -> Dict[str, Any]:
        """
        Internal execution logic - queries knowledge base with thread-safe initialization
        
        Args:
            state: Current unified state
        
        Returns:
            RAG query results
        """
        # Ensure vectorstore is initialized (thread-safe)
        await self._ensure_initialized()
        
        if not RAGEngine._vectorstore:
            raise CapabilityError(
                message="Vector store not initialized",
                capability_name=self.capability_name,
                error_code="RAG_VECTORSTORE_NOT_INITIALIZED",
                recoverable=True
            )
        
        query: str = state["input_data"]
        
        try:
            # Perform similarity search
            docs: List[Document] = await self._async_similarity_search(
                query,
                k=self.config.rag.search_k
            )
            
            if not docs:
                return {
                    "answer": "I couldn't find any relevant information in the knowledge base for your query.",
                    "documents": [],
                    "confidence": 0.0,
                    "status": "no_results",
                    "result": "No relevant information found"
                }
            
            # Filter by similarity threshold if available
            filtered_docs: List[Document] = self._filter_by_similarity(docs)
            
            if not filtered_docs:
                return {
                    "answer": "The information I found doesn't seem relevant enough to your query.",
                    "documents": [self._doc_to_dict(d) for d in docs],
                    "confidence": 0.3,
                    "status": "low_relevance",
                    "result": "Low relevance results"
                }
            
            # Generate answer using retrieved context
            answer = await self._generate_answer(query, filtered_docs)
            
            return {
                "answer": answer,
                "documents": [self._doc_to_dict(d) for d in filtered_docs],
                "confidence": 0.85,
                "status": "success",
                "result": answer
            }
            
        except Exception as e:
            self.logger.error("rag_query_failed", {"query": query, "error": str(e)}, error=e)
            raise CapabilityError(
                message=f"RAG query failed: {str(e)}",
                capability_name=self.capability_name,
                error_code="RAG_QUERY_ERROR",
                recoverable=True,
                original_error=e
            )
    
    async def _async_similarity_search(self, query: str, k: int) -> List[Document]:
        """
        Async wrapper for similarity search
        
        Args:
            query: Search query
            k: Number of results to return
        
        Returns:
            List of relevant documents
        """
        # Run synchronous similarity_search in thread pool
        loop = asyncio.get_event_loop()
        docs = await loop.run_in_executor(
            None,
            RAGEngine._vectorstore.similarity_search,
            query,
            k
        )
        return docs
    
    def _filter_by_similarity(self, docs: List[Document]) -> List[Document]:
        """
        Filter documents by similarity threshold
        
        Args:
            docs: Documents to filter
        
        Returns:
            Filtered documents above threshold
        """
        # If docs have scores, filter by threshold
        # Note: Chroma similarity_search doesn't return scores by default
        # Use similarity_search_with_score for this functionality
        
        # For now, return all docs (can enhance with similarity_search_with_score)
        return docs
    
    async def _generate_answer(self, query: str, docs: List[Document]) -> str:
        """
        Generate answer using LLM and retrieved documents
        
        Args:
            query: User query
            docs: Retrieved documents
        
        Returns:
            Generated answer
        """
        # Build context from documents
        context = "\n\n".join([
            f"Document {i+1}:\n{doc.page_content}"
            for i, doc in enumerate(docs)
        ])
        
        # Create system prompt
        system_prompt = """You are a helpful assistant that answers questions based on the provided context.
Use ONLY the information from the context to answer the question.
If the context doesn't contain enough information, say so.
Be concise and specific."""
        
        # Create user prompt
        user_prompt = f"""Context:
{context}

Question: {query}

Answer based on the context above:"""
        
        # Generate answer using LLM
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = await self.llm.ainvoke(messages)
        
        return response.content
    
    def _doc_to_dict(self, doc: Document) -> Dict[str, Any]:
        """Convert document to dictionary for response"""
        return {
            "content": doc.page_content,
            "metadata": doc.metadata
        }
    
    async def add_documents(
        self,
        documents: List[Document],
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Add documents to the vector store (thread-safe)
        
        Args:
            documents: Documents to add
            user_id: Optional user ID to associate with documents
        
        Returns:
            Result with document IDs
        """
        # Ensure initialized
        await self._ensure_initialized()
        
        try:
            # Add user_id to metadata if provided
            if user_id:
                for doc in documents:
                    doc.metadata["user_id"] = user_id
            
            # Add documents to vectorstore
            ids = RAGEngine._vectorstore.add_documents(documents)
            
            # Persist changes
            RAGEngine._vectorstore.persist()
            
            self.logger.info("rag_documents_added", {
                "count": len(documents),
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
