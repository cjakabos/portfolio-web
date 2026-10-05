---
id: REQ-RAG-001
title: Document ingestion and retrieval-augmented answers
status: proposed
owner: ai-platform
basis: code-derived-current-behavior
review: pending-product-validation
---

# REQ-RAG-001 — RAG documents and queries

## Observed behavior

The AI orchestration service accepts document uploads asynchronously, exposes upload-job status, lists and retrieves document metadata, supports document deletion, and answers retrieval queries from the indexed corpus. Upload validation accepts PDF, DOCX, DOC, TXT, Markdown, and CSV files up to 10 MiB; the monitor provides document and query workflows. The current RAG router does not declare direct authenticated-user or administrator dependencies on these endpoints; deployment-level access controls need separate validation before this is accepted as a security requirement.

These statements describe current code behavior. Confirm them as product intent before changing the status to accepted.

## Evidence

- ai-orchestration/ai-orchestration-layer/src/routers/rag_router.py — upload jobs, document CRUD, query, and stats
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
    Given the monitor submits a supported document to the RAG service
    When the upload is accepted
    Then the service returns a job identifier whose status can be queried until processing completes or fails

  @AC-REQ-RAG-001-02
  Scenario: Query indexed documents
    Given documents have completed ingestion
    When a user submits a RAG query
    Then the service returns an answer with retrieved document context

  @AC-REQ-RAG-001-03
  Scenario: Remove a document from the indexed corpus
    Given a document is present in the RAG corpus
    When the monitor requests deletion of that document
    Then the service removes it and it no longer appears in the document list
```
