# AI Runbook: RAG Ingestion Failure

Use this runbook when document uploads, indexing, or retrieval fail in the
operator RAG surface.

## Trigger

- upload jobs stall in `pending`, `parsing`, or `embedding`
- upload jobs move to `failed`
- `GET /ai/rag/health` reports `unhealthy`
- query responses return `500` or empty retrieval unexpectedly

## Likely Causes

- ChromaDB is unavailable
- the embedding model or its host is unavailable
- the uploaded file is unsupported, empty, or larger than the accepted limit
- background upload processing started but failed during parsing or indexing

## Immediate Checks

1. Call `GET /ai/rag/health`.
2. Review the latest upload job status from
   `GET /ai/rag/documents/upload/status/{job_id}`.
3. Check service logs for:
   - upload initiation failures
   - parsing errors
   - embedding failures
   - indexing failures
4. Confirm ChromaDB and the configured embedding model endpoint are reachable
   from the AI orchestration container.

## Containment

1. Pause bulk uploads while the RAG backend is unhealthy.
2. If only one document type is failing, constrain uploads to known-good text
   or markdown samples until the parser issue is fixed.
3. Keep non-RAG monitor capabilities available; do not restart the whole stack
   unless the failure is broader than RAG.

## Recovery

1. Restore ChromaDB and the embedding path.
2. Restart the AI orchestration service only if `GET /ai/rag/health` does not
   recover after the dependency is restored.
3. Re-run a small text upload and confirm:
   - upload accepted
   - status reaches `completed`
   - document appears in `GET /ai/rag/documents`
4. If the original failed upload matters, re-submit it after health is stable.

## Escalate When

- ChromaDB is healthy, but `GET /ai/rag/health` stays unhealthy
- upload jobs fail for small text fixtures after dependency recovery
- uploads complete, but subsequent query behavior remains empty or inconsistent

## Aftercare

- note whether the failure was parser-specific, embedding-specific, or storage-specific
- attach one failed job payload and the corresponding log excerpt
- record whether any documents need a manual re-index after recovery
