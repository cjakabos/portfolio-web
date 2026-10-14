---
schema_version: 1
id: REQ-RAG-001
title: Document ingestion and retrieval-augmented answers
status: accepted
owner: ai-platform
basis: code-derived-current-behavior
review: requirements/reviews/ACCESS-2026-10-12.md
---

# REQ-RAG-001 — RAG documents and queries

## Product intent

The AI orchestration service provides an administrator-managed shared document corpus. It accepts document uploads asynchronously, exposes upload-job status, lists and retrieves document metadata, supports document deletion, and answers retrieval queries from the indexed corpus. Upload validation accepts PDF, DOCX, DOC, TXT, Markdown, and CSV files up to 10 MiB; the administrator monitor provides document and query workflows.

All RAG HTTP operations, including document/job reads, queries, statistics, and
RAG-specific health, require a CloudApp-verified administrator session at the
gateway and service boundary. Requests without credentials receive 401 at the
service; the gateway rejects unauthenticated callers with 401 or 403. Regular
users receive 403. Caller-supplied roles, user IDs, and internal service tokens
cannot bypass these checks. Optional user IDs remain administrator-selected
metadata and retrieval filters; they do not establish tenant ownership. The
general AI readiness endpoint remains available separately.

RAG capability execution also verifies the original administrator requester
when reached through explicit or inferred orchestration, parallel tasks, or
WebSocket streaming. Approval does not elevate a regular requester's corpus
access. Resuming RAG requires fresh administrator credentials matching the
original requester; credentials are not persisted in workflow state.

The repository owner approved this operator policy in the
[human decision](reviews/ACCESS-2026-10-12.md), scoped to the local showcase.

## Evidence

- ai-orchestration/ai-orchestration-layer/src/routers/rag_router.py — upload jobs, document CRUD, query, and stats
- ai-orchestration/ai-orchestration-layer/src/auth.py — verified CloudApp administrator sessions
- ai-orchestration/ai-orchestration-layer/src/core/orchestrator.py — RAG capability authorization across orchestration paths
- frontend/nginx/conf/locations.conf — administrator-only RAG gateway paths
- ai-orchestration/ai-orchestration-layer/src/capabilities/upload_job_manager.py — asynchronous job state
- ai-orchestration/ai-orchestration-layer/src/capabilities/document_parser.py — supported document parsing
- ai-orchestration/ai-orchestration-layer/src/capabilities/rag_engine.py — indexing and retrieval
- ai-orchestration/ai-orchestration-monitor/components/RAGDashboard.tsx — operator RAG workflows
- tests/ai-load/rag-upload.js — upload journey fixture

## Acceptance scenarios

```gherkin
@REQ-RAG-001
Feature: Ingest and query documents with retrieval

  @AC-REQ-RAG-001-01
  Scenario: Track an asynchronous document upload
    Given an administrator uses the monitor to submit a supported document to the RAG service
    When the upload is accepted
    Then the service returns a job identifier whose status can be queried until processing completes or fails

  @AC-REQ-RAG-001-02
  Scenario: Query indexed documents
    Given documents have completed ingestion
    When an administrator submits a RAG query
    Then the service returns an answer with retrieved document context

  @AC-REQ-RAG-001-03
  Scenario: Remove a document from the indexed corpus
    Given a document is present in the RAG corpus
    When an administrator uses the monitor to request deletion of that document
    Then the service removes it and it no longer appears in the document list

  @AC-REQ-RAG-001-04
  Scenario: Reject callers without administrator authority for every RAG operation
    Given an unauthenticated caller or an authenticated regular user
    When the caller requests a document, upload, upload job, query, deletion, statistics, or RAG health through the service HTTP API
    Then the unauthenticated caller receives 401 and the regular user receives 403
    And no RAG data operation executes
    And orchestration, streaming, parallel tasks, and approval cannot bypass administrator authority for the original requester
```
