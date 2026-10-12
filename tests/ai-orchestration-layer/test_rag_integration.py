"""Real parser, job manager, RAG engine and on-disk Chroma; model I/O is deterministic."""
from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks, UploadFile
from langchain_core.embeddings import Embeddings

from capabilities.document_parser import DocumentParser
from capabilities.upload_job_manager import UploadJobManager
from capabilities import rag_engine
from routers import rag_router


class LocalEmbeddings(Embeddings):
    def embed_documents(self, texts):
        return [self.embed_query(text) for text in texts]

    def embed_query(self, text):
        return [1.0, 0.0] if "battery" in text.lower() else [0.0, 1.0]


@pytest.fixture
def corpus(tmp_path, monkeypatch):
    monkeypatch.setenv("CHROMA_PERSIST_DIR", str(tmp_path / "chroma"))
    monkeypatch.setenv("ANONYMIZED_TELEMETRY", "False")
    prompts = []

    class AnswerModel:
        async def ainvoke(self, messages):
            prompts.append(messages)
            return SimpleNamespace(content="The battery lasts eight hours. Recharge it overnight for best results.")

    class Models:
        embedding_model = "deterministic-test-embedding"
        rag_model = "test-answer-model"
        base_url = "http://model.test.invalid"

        def get_embeddings(self, **kwargs):
            return LocalEmbeddings()

        async def fetch_available_models(self):
            return [SimpleNamespace(name=self.rag_model)], True, None

        def get_rag_llm(self):
            return AnswerModel()

    for field, value in {"_initialized": False, "_vectorstore": None, "_embeddings": None,
                         "_document_registry": {}, "_initialization_lock": None,
                         "_current_embedding_model": None, "_registry_file": None}.items():
        monkeypatch.setattr(rag_engine.RAGEngine, field, value)
    monkeypatch.setattr(rag_engine, "get_llm_manager", Models)
    engine = rag_engine.RAGEngine()
    engine.llm_manager = Models()
    manager = UploadJobManager(str(tmp_path / "jobs"))
    monkeypatch.setattr(rag_router, "_get_engine", lambda: engine)
    monkeypatch.setattr(rag_router, "_get_parser", DocumentParser)
    monkeypatch.setattr(rag_router, "_get_job_manager", lambda: manager)
    return engine, manager, prompts


async def upload(filename, content):
    tasks = BackgroundTasks()
    response = await rag_router.upload_document_async(tasks, UploadFile(filename=filename, file=BytesIO(content)), 7, None, None)
    return response, tasks


@pytest.mark.asyncio
async def test_real_upload_jobs_progress_to_completed_and_failed(corpus):
    engine, manager, _ = corpus
    response, tasks = await upload("battery.md", b"The battery lasts eight hours. Recharge it overnight for best results.")
    assert (await rag_router.get_upload_status(response.job_id)).status == "pending"
    stages = []
    update = manager.update_job

    async def capture(job_id, **values):
        result = await update(job_id, **values)
        stages.append((result.to_dict()["status"], result.progress))
        return result

    manager.update_job = capture
    await tasks()
    status = await rag_router.get_upload_status(response.job_id)
    assert status.status == "completed" and status.progress == 100
    assert status.chunks_created > 0 and status.doc_id
    assert {stage for stage, _ in stages} >= {"parsing", "embedding", "indexing", "completed"}
    assert [value for _, value in stages] == sorted(value for _, value in stages)
    assert await engine.get_document_info(status.doc_id)
    failed, tasks = await upload("blank.md", b"   \n\t")
    await tasks()
    status = await rag_router.get_upload_status(failed.job_id)
    assert status.status == "failed"
    assert "Could not extract" in status.error
    restored = UploadJobManager(str(manager._persist_dir))
    assert (await restored.get_job(response.job_id)).status.value == "completed"
    assert (await restored.get_job(failed.job_id)).status.value == "failed"


@pytest.mark.asyncio
async def test_real_corpus_ranks_retrieved_context_and_builds_grounded_answer_prompt(corpus):
    _, _, prompts = corpus
    for filename, text in [("battery.md", b"The battery lasts eight hours. Recharge it overnight for best results."), ("flowers.md", b"Flowers bloom in spring and thrive in well drained soil outdoors.")]:
        _, tasks = await upload(filename, text)
        await tasks()
    result = await rag_router.query_documents(rag_router.QueryRequest(query="battery duration", user_id=7, top_k=1))
    assert result.answer == "The battery lasts eight hours. Recharge it overnight for best results."
    assert result.sources[0].filename == "battery.md"
    assert result.sources[0].content == "The battery lasts eight hours. Recharge it overnight for best results."
    assert result.documents_searched == 1 and result.chunks_retrieved == 1
    assert result.sources[0].similarity_score == pytest.approx(1.0)
    assert "based ONLY on the provided context" in prompts[0][0].content
    assert "Context:\nSource 1: The battery lasts eight hours. Recharge it overnight for best results." in prompts[0][1].content
    assert "Flowers bloom" not in prompts[0][1].content


@pytest.mark.asyncio
async def test_real_delete_removes_vectors_registry_and_reloaded_document_list(corpus):
    engine, _, _ = corpus
    response, tasks = await upload("battery.md", b"The battery lasts eight hours. Recharge it overnight for best results.")
    await tasks()
    doc_id = (await rag_router.get_upload_status(response.job_id)).doc_id
    assert (await rag_router.list_documents(7, 100)).total == 1
    assert (await rag_router.delete_document(doc_id)).deleted is True
    assert (await rag_router.list_documents(7, 100)).documents == []
    assert engine._vectorstore._collection.get(where={"doc_id": doc_id})["ids"] == []
    engine._document_registry.clear()
    engine._load_registry()
    assert await engine.list_documents() == []
    assert (await rag_router.query_documents(rag_router.QueryRequest(query="battery", user_id=7))).sources == []
