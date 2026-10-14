---
schema_version: 1
id: REQ-WORKSPACE-001
title: Personal notes and file workspace
status: accepted
owner: cloudapp-product
basis: code-derived-current-behavior
review: requirements/reviews/BASELINE-2026-10-12.md
---

# REQ-WORKSPACE-001 — Personal notes and files

## Product intent

The signed-in workspace lets a user list, create, update, and delete personal notes, and upload, list, download, and delete personal files. The backend checks that a user accesses their own records. Notes require a title and description and reject descriptions of 1,000 characters or more. File uploads reject empty files, duplicate filenames for the same user, missing filenames, and files larger than 2,000,000 bytes.

The repository owner accepted this behavior for the local portfolio showcase.
The [human decision](reviews/BASELINE-2026-10-12.md) records the scope and demo
limits; implementation evidence remains as provenance.

## Evidence

- frontend/cloudapp-shell/src/components/FilesNotesWorkspace.tsx — Files and Notes workspace interactions
- backend/cloudapp/src/main/java/com/example/demo/controllers/NoteController.java — note operations, ownership, and length rule
- backend/cloudapp/src/main/java/com/example/demo/content/NoteContentService.java — note persistence
- backend/cloudapp/src/main/java/com/example/demo/controllers/FileController.java — file operations and ownership checks
- backend/cloudapp/src/main/java/com/example/demo/content/FileContentService.java — size, empty-file, filename, and duplicate checks

## Acceptance scenarios

```gherkin
@REQ-WORKSPACE-001
Feature: Manage personal notes and files

  @AC-REQ-WORKSPACE-001-01
  Scenario: Create and maintain a personal note
    Given a signed-in user
    When the user creates, edits, or deletes a note with a title and a description shorter than 1000 characters
    Then the note is saved under that user and the resulting list reflects the operation

  @AC-REQ-WORKSPACE-001-02
  Scenario: Prevent access to another user's notes and files
    Given a signed-in user and a note or file owned by another user
    When the signed-in user requests that record by username or record identifier
    Then the backend denies access

  @AC-REQ-WORKSPACE-001-03
  Scenario: Upload and retrieve an allowed file
    Given a signed-in user and a non-empty file no larger than 2000000 bytes with a filename not already used by that user
    When the user uploads the file
    Then the file is listed for that user and can be downloaded and deleted by that user

  @AC-REQ-WORKSPACE-001-04
  Scenario: Reject invalid file uploads
    Given an empty file, an oversized file, a missing filename, or a duplicate filename for that user
    When the user uploads the file
    Then the backend rejects the upload
```
