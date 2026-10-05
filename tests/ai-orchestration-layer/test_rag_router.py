from io import BytesIO
from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks, HTTPException, UploadFile

from routers import rag_router


class FakeJobManager:
    def __init__(self):
        self.created_filename = None

    async def create_job(self, filename):
        self.created_filename = filename
        return SimpleNamespace(
            job_id="job-123", filename=filename, status=SimpleNamespace(value="pending")
        )

    async def get_job(self, job_id):
        assert job_id == "job-123"
        return SimpleNamespace(
            to_dict=lambda: {
                "job_id": "job-123",
                "filename": "guide.md",
                "status": "completed",
                "progress": 100,
                "message": "Indexed",
                "created_at": "now",
                "updated_at": "now",
            }
        )


@pytest.mark.asyncio
async def test_upload_document_async_returns_job_and_schedules_processing(monkeypatch):
    manager = FakeJobManager()
    monkeypatch.setattr(rag_router, "_get_job_manager", lambda: manager)
    upload = UploadFile(filename="guide.md", file=BytesIO(b"A useful guide"))
    background = BackgroundTasks()

    response = await rag_router.upload_document_async(
        background, upload, 7, "docs,guide", "help"
    )

    assert response.job_id == "job-123"
    assert response.status == "pending"
    assert manager.created_filename == "guide.md"
    assert len(background.tasks) == 1
    task = background.tasks[0]
    assert task.func is rag_router.process_upload_job
    assert task.args == (
        "job-123",
        "guide.md",
        b"A useful guide",
        7,
        {"tags": ["docs", "guide"], "category": "help"},
    )
    status = await rag_router.get_upload_status("job-123")
    assert status.status == "completed"
    assert status.progress == 100


@pytest.mark.asyncio
async def test_query_documents_returns_sources_and_forwards_options(monkeypatch):
    class FakeEngine:
        def __init__(self):
            self.request = None

        async def query(self, **kwargs):
            self.request = kwargs
            return SimpleNamespace(
                answer="Use the guide.",
                query=kwargs["query"],
                documents_searched=1,
                chunks_retrieved=1,
                confidence=0.9,
                sources=[
                    {
                        "content": "guide passage",
                        "doc_id": "doc-1",
                        "filename": "guide.md",
                        "similarity_score": 0.9,
                    }
                ],
            )

    engine = FakeEngine()
    monkeypatch.setattr(rag_router, "_get_engine", lambda: engine)
    response = await rag_router.query_documents(
        rag_router.QueryRequest(
            query="  how?  ", user_id=7, top_k=3, generate_answer=False
        )
    )

    assert engine.request == {
        "query": "how?",
        "user_id": 7,
        "top_k": 3,
        "generate_answer": False,
    }
    assert response.answer == "Use the guide."
    assert response.sources[0].doc_id == "doc-1"
    assert response.chunks_retrieved == 1


@pytest.mark.asyncio
async def test_delete_document_reports_engine_result(monkeypatch):
    class FakeEngine:
        async def delete_document(self, doc_id):
            assert doc_id == "doc-1"
            return {"deleted": True}

    monkeypatch.setattr(rag_router, "_get_engine", FakeEngine)
    response = await rag_router.delete_document("doc-1")
    assert response.doc_id == "doc-1"
    assert response.deleted is True


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_file_type():
    upload = UploadFile(filename="script.exe", file=BytesIO(b"bad"))
    with pytest.raises(HTTPException) as error:
        await rag_router.upload_document_async(BackgroundTasks(), upload)
    assert error.value.status_code == 400
