# Umami Analytics Runbook

This repo uses a self-hosted Umami instance for privacy-first product analytics. The shell app owns the tracker script, pageview tracking, and the global `beforeSend` privacy filter. Remote modules only emit events through `window.umami?.track(...)`.

## Environment

Root `.env` values:

```bash
UMAMI_DB_NAME=umami
UMAMI_DB_USER=umami
UMAMI_DB_PASSWORD=replace-me
UMAMI_APP_SECRET=replace-me-with-openssl-rand-hex-32
NEXT_PUBLIC_UMAMI_HOST_URL=http://localhost:3001
NEXT_PUBLIC_UMAMI_WEBSITE_ID=<website-id-from-umami-ui>
NEXT_PUBLIC_UMAMI_DOMAINS=localhost,127.0.0.1
```

Notes:
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is a build-time value for the shell app. Rebuild the shell image after you create or change the website entry in Umami.
- `NEXT_PUBLIC_UMAMI_DOMAINS` must list the app hostnames you want tracked, not the Umami admin host.

## Privacy Defaults

The shell tracker is configured with these defaults:

- `data-auto-track="false"`: pageviews are emitted manually on route changes.
- `data-do-not-track="true"`: browser DNT is respected.
- `data-exclude-search="true"` and `data-exclude-hash="true"`: page URLs are recorded without query strings or hashes.
- `data-before-send="cloudAppUmamiBeforeSend"`: payloads are sanitized before sending.

The `beforeSend` filter:

- strips query strings and hashes from tracked URLs
- strips query strings and hashes from referrers
- removes sensitive keys such as `email`, `token`, `password`, `authorization`, `session`, `cookie`, `jwt`, and `username`
- blocks Umami `identify` payloads entirely

## Event Catalog

Shell and shared flows:

- `auth_login_success`
- `auth_register_success`
- `auth_logout`
- `auth_access_denied`
- `auth_mode_toggle`
- `nav_click`
- `dashboard_card_click`
- `files_upload`
- `files_download`
- `files_delete`
- `notes_create`
- `notes_update`
- `notes_delete`
- `shop_add_to_cart`
- `shop_cart_clear`
- `shop_checkout_submit`
- `shop_item_create`
- `chat_room_create`
- `chat_room_join`
- `chat_message_send`

OpenMaps:

- `maps_vehicle_create`
- `maps_vehicle_update`
- `maps_vehicle_delete`
- `maps_map_click_admin`
- `maps_panel_toggle`

ChatLLM:

- `llm_models_refresh`
- `llm_model_select`
- `llm_prompt_submit`
- `llm_generation_stop`

MLOps:

- `mlops_manual_recluster_submit`
- `mlops_sample_run`
- `mlops_table_page_change`
- `mlops_viz_tab_change`

Jira:

- `jira_ticket_create`
- `jira_ticket_update`
- `jira_ticket_delete`
- `jira_chat_open`
- `jira_ai_refine_submit`
- `jira_batch_request_ai`
- `jira_batch_create`
- `jira_ai_models_refresh`
- `jira_ai_assistant_toggle`

PetStore:

- `petstore_dashboard_nav`
- `petstore_nav_click`
- `petstore_customer_create`
- `petstore_pet_create`
- `petstore_employee_create`
- `petstore_schedule_fetch`
- `petstore_schedule_create`

## Suggested Goals and Funnels

Suggested goals:

- `auth_login_success`
- `shop_checkout_submit`
- `jira_ticket_create`
- `mlops_manual_recluster_submit`
- `llm_prompt_submit`
- `petstore_schedule_create`

Suggested funnels:

- `/login` -> `auth_login_success` -> `dashboard_card_click`
- `/jira` -> `jira_chat_open` -> `jira_ai_refine_submit` -> `jira_ticket_update`
- `/petstore` -> `petstore_dashboard_nav` -> `petstore_schedule_fetch` -> `petstore_schedule_create`

## Local Validation

1. Run `make bootstrap-umami-db`.
2. Run `docker compose -f docker-compose-infrastructure.yml up -d umami`.
3. Create the website entry in Umami and copy the website ID into `.env`.
4. Rebuild the shell app so the public website ID is included.
5. Open the app, navigate through the main modules, and verify pageviews and events in the Umami dashboard.
