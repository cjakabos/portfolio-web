# ============================================================================
# File: backend/ai-orchestration-layer/src/capabilities/upload_job_manager.py
# Background Job Manager - WITH DISK PERSISTENCE
# ============================================================================

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)


class JobStatus(str, Enum):
    """Upload job status"""
    PENDING = "pending"
    PARSING = "parsing"
    EMBEDDING = "embedding"
    INDEXING = "indexing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class UploadJob:
    """Tracks an upload job's progress"""
    job_id: str
    filename: str
    status: JobStatus
    progress: int = 0  # 0-100
    message: str = ""
    doc_id: Optional[str] = None
    chunks_created: int = 0
    char_count: int = 0
    word_count: int = 0
    doc_type: str = "unknown"
    error: Optional[str] = None
    user_id: Optional[int] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "filename": self.filename,
            "status": self.status.value if isinstance(self.status, JobStatus) else self.status,
            "progress": self.progress,
            "message": self.message,
            "doc_id": self.doc_id,
            "chunks_created": self.chunks_created,
            "char_count": self.char_count,
            "word_count": self.word_count,
            "doc_type": self.doc_type,
            "error": self.error,
            "user_id": self.user_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UploadJob":
        """Create UploadJob from dictionary."""
        status = data.get("status", "pending")
        if isinstance(status, str):
            try:
                status = JobStatus(status)
            except ValueError:
                status = JobStatus.PENDING

        return cls(
            job_id=data["job_id"],
            filename=data["filename"],
            status=status,
            progress=data.get("progress", 0),
            message=data.get("message", ""),
            doc_id=data.get("doc_id"),
            chunks_created=data.get("chunks_created", 0),
            char_count=data.get("char_count", 0),
            word_count=data.get("word_count", 0),
            doc_type=data.get("doc_type", "unknown"),
            error=data.get("error"),
            user_id=data.get("user_id"),
            created_at=data.get("created_at", datetime.utcnow().isoformat() + "Z"),
            updated_at=data.get("updated_at", datetime.utcnow().isoformat() + "Z"),
        )


class UploadJobManager:
    """
    Manages background upload jobs with progress tracking and disk persistence.

    Jobs are persisted to disk so they survive server restarts.
    """

    def __init__(self, persist_dir: str = "/data/chroma"):
        self._jobs: Dict[str, UploadJob] = {}
        self._lock = asyncio.Lock()
        self._persist_dir = Path(persist_dir)
        self._jobs_file = self._persist_dir / "upload_jobs.json"
        # Keep completed/failed jobs for 1 hour
        self._job_ttl_seconds = 3600
        # Load existing jobs from disk
        self._load_jobs()

    def _load_jobs(self):
        """Load jobs from disk on startup."""
        if not self._jobs_file.exists():
            logger.info("No existing upload jobs file found")
            return

        try:
            data = json.loads(self._jobs_file.read_text())
            for job_data in data.values():
                job = UploadJob.from_dict(job_data)
                # Mark stale "in-progress" jobs as failed (server restarted mid-process)
                if job.status not in (JobStatus.COMPLETED, JobStatus.FAILED):
                    job.status = JobStatus.FAILED
                    job.error = "Server restarted during processing. Please re-upload."
                    job.updated_at = datetime.utcnow().isoformat() + "Z"
                self._jobs[job.job_id] = job

            logger.info(f"Loaded {len(self._jobs)} upload jobs from disk")
            self._save_jobs()  # Save with updated statuses
        except Exception as e:
            logger.error(f"Failed to load upload jobs: {e}")
            self._jobs = {}

    def _save_jobs(self):
        """Persist jobs to disk."""
        try:
            self._persist_dir.mkdir(parents=True, exist_ok=True)
            data = {job_id: job.to_dict() for job_id, job in self._jobs.items()}
            self._jobs_file.write_text(json.dumps(data, indent=2))
        except Exception as e:
            logger.error(f"Failed to save upload jobs: {e}")

    async def create_job(self, filename: str, user_id: Optional[int] = None) -> UploadJob:
        """Create a new upload job."""
        job_id = f"upload_{uuid.uuid4().hex[:12]}"
        job = UploadJob(
            job_id=job_id,
            filename=filename,
            status=JobStatus.PENDING,
            message="Upload received, starting processing...",
            user_id=user_id,
        )

        async with self._lock:
            self._jobs[job_id] = job
            self._save_jobs()
            await self._cleanup_old_jobs()

        return job

    async def get_job(self, job_id: str) -> Optional[UploadJob]:
        """Get job by ID."""
        return self._jobs.get(job_id)

    async def update_job(
        self,
        job_id: str,
        status: Optional[JobStatus] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        **kwargs
    ) -> Optional[UploadJob]:
        """Update job progress."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None

            if status:
                job.status = status
            if progress is not None:
                job.progress = progress
            if message:
                job.message = message

            for key, value in kwargs.items():
                if hasattr(job, key):
                    setattr(job, key, value)

            job.updated_at = datetime.utcnow().isoformat() + "Z"
            self._save_jobs()
            return job

    async def fail_job(self, job_id: str, error: str) -> Optional[UploadJob]:
        """Mark job as failed."""
        return await self.update_job(
            job_id,
            status=JobStatus.FAILED,
            error=error,
            message=f"Failed: {error}"
        )

    async def complete_job(
        self,
        job_id: str,
        doc_id: str,
        chunks_created: int,
        char_count: int,
        word_count: int,
        doc_type: str
    ) -> Optional[UploadJob]:
        """Mark job as completed."""
        return await self.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=100,
            message="Document processed successfully",
            doc_id=doc_id,
            chunks_created=chunks_created,
            char_count=char_count,
            word_count=word_count,
            doc_type=doc_type
        )

    async def list_jobs(
        self,
        limit: int = 50,
        user_id: Optional[int] = None,
        include_completed: bool = True
    ) -> List[Dict[str, Any]]:
        """List recent jobs, optionally filtered by user_id."""
        jobs = list(self._jobs.values())

        # Filter by user_id if provided
        if user_id is not None:
            jobs = [j for j in jobs if j.user_id == user_id]

        # Optionally filter out completed/failed
        if not include_completed:
            jobs = [j for j in jobs if j.status not in (JobStatus.COMPLETED, JobStatus.FAILED)]

        # Sort by created_at descending
        jobs.sort(key=lambda j: j.created_at, reverse=True)

        return [j.to_dict() for j in jobs[:limit]]

    async def list_active_jobs(self, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """List only active (in-progress) jobs."""
        return await self.list_jobs(user_id=user_id, include_completed=False)

    async def _cleanup_old_jobs(self):
        """Remove jobs older than TTL."""
        now = datetime.utcnow()
        to_remove = []

        for job_id, job in self._jobs.items():
            if job.status in (JobStatus.COMPLETED, JobStatus.FAILED):
                try:
                    created = datetime.fromisoformat(job.created_at.replace("Z", ""))
                    age = (now - created).total_seconds()
                    if age > self._job_ttl_seconds:
                        to_remove.append(job_id)
                except:
                    pass

        for job_id in to_remove:
            del self._jobs[job_id]

        if to_remove:
            self._save_jobs()
            logger.debug(f"Cleaned up {len(to_remove)} old upload jobs")


# Singleton instance
_job_manager: Optional[UploadJobManager] = None


def get_job_manager() -> UploadJobManager:
    """Get or create job manager instance."""
    global _job_manager
    if _job_manager is None:
        import os
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "/data/chroma")
        _job_manager = UploadJobManager(persist_dir=persist_dir)
    return _job_manager