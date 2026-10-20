# IncuBrix Long-Tail Distribution Connector Service

A contract-compliant connector service and posting rules engine designed to syndicate creator and B2B content across long-tail platforms (developer blogs, forums, federated networks, and partner webhooks) without spamming or violating community rules.

Built in **TypeScript (Node 22)** and **Express.js**, featuring pre-publish policy enforcement, double-layer idempotency, an automated 10-minute test post cleanup reaper, file storage ingestion, and a minimal React dashboard.

---

## Architecture Overview

```
                               +-------------------------------------+
                               |          IncuBrix Runtime           |
                               +-------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         | (Appendix A Contract)                           | (Integration Standard)
                         v                                                 v
           +-----------------------------+                   +-----------------------------+
           | POST /connector/v1/{k}/{m}  |                   | POST /api/v1/publish        |
           +-----------------------------+                   +-----------------------------+
                         |                                                 |
                         +------------------------+------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               |        Request Middleware           |
                               |  - X-Correlation-Id Injection       |
                               |  - Idempotency Safe Retry Lock      |
                               |  - Secret Token Redaction Logger    |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               |         Posting Rules Engine        |
                               |  - Frequency Cap Tracking (1/week)  |
                               |  - Self-Promotion Policy Gate       |
                               |  - Strict Link Policy (no_links)    |
                               |  - Mandatory AI Disclosure Appender |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               |      Connector Registry Engine      |
                               +-------------------------------------+
                                                  |
         +-----------------+----------------------+-----------------+-----------------+
         |                 |                      |                 |                 |
         v                 v                      v                 v                 v
   +-----------+    +-------------+        +-------------+    +-----------+    +--------------+
   | Discourse |    |    Lemmy    |        |   Dev.to    |    |   Ghost   |    | Webhook/HMAC |
   |  (Forum)  |    | (Federated) |        |  (Dev Blog) |    |  (Admin)  |    |  (Partner)   |
   +-----------+    +-------------+        +-------------+    +-----------+    +--------------+
         |                 |                      |                 |                 |
   +-----------+    +-------------+        +-------------+    +-----------+    +--------------+
   | Assisted  |    |  Hashnode   |        |    Slack    |    |   MRSS    |    | Local Storage|
   | (Human)   |    |  (GraphQL)  |        |  (Incoming) |    |  (Feed)   |    | (S3/Files)   |
   +-----------+    +-------------+        +-------------+    +-----------+    +--------------+
```

---

## Quickstart (Under 5 Commands)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*(Runs out of the box with zero paid API keys in simulation and local container mode).*

### 3. Run All Automated Tests
```bash
npm test
```
*Runs all 55 tests across 6 test suites (unit, contract, rules, reaper, idempotency, and advanced benchmarks).*

### 4. Run Connector Certification Harness
```bash
npm run test:certification
```
*Certifies all 9 connectors (6 Core + 3 Advanced) and writes audit evidence files to `data/certification/`.*

### 5. Start the Application
```bash
# Option A: Start backend service (instant local execution)
npm run dev

# Option B: Run full Docker Compose environment (Service, Ghost, Lemmy, Redis, Postgres)
docker compose up -d
```
Access the web dashboard at: **`http://localhost:3000`**

---

## Verified Connectors (6 Core + 3 Advanced)

1. **Discourse (`native`)**: Topic syndication with auto-tagging and guidelines compliance.
2. **Lemmy (`protocol`)**: ActivityPub / JSON API federated community post publisher.
3. **Dev.to (`bridge`)**: Markdown developer article syndication with main image attachments.
4. **Ghost (`native`)**: Ghost Admin API v5 with short-lived HS256 JWT generation and slug handling.
5. **Generic Webhook (`bridge`)**: Partner network event dispatch with SHA256 HMAC signature verification (`x-signature-sha256`).
6. **Assisted Connector (`assisted`)**: Human-in-the-loop content pack generator for communities that ban bots (Indie Hackers). Implements `buildAssistPack` and interactive portal at `/mock/assisted/submit`.
7. **Hashnode (`native`)**: GraphQL publication API for developer blogging.
8. **Slack (`bridge`)**: Rich block messaging and channel broadcast.
9. **MRSS (`feed`)**: Media RSS feed XML syndication for creator podcasts and video feeds.

---

## Key Features & Compliance

### 1. Pre-Publish Rules Engine (Must-Have 4)
- **Frequency Caps:** Tracks post history per community (e.g. `1/week`, `2/day`). Violations return `DEST_RULE_FREQUENCY_CAP` (429) with reschedule countdown.
- **Self-Promotion Guard:** Rejects promotional content on communities with `self_promo_allowed = false` (`PLATFORM_CONTENT_REJECTED` 422).
- **Link Policy:** Enforces `no_links` in post bodies and flags `first_comment` requirements.
- **Mandatory AI Disclosure:** Automatically detects missing AI disclosures and appends standardized community attribution.

### 2. Safe Retries & In-Flight Deduplication (Must-Have 6 & Standard 4)
- Every POST endpoint supports the `Idempotency-Key` header.
- In-flight duplicate requests lock using Node's `EventEmitter` and wait for the original call, returning the identical post ID with `X-Cache-Lookup: HIT`. Zero duplicate posts created under rapid retries.

### 3. 10-Minute Auto-Cleanup Reaper (Must-Have 5)
- Tracks every test post with an automatic 10-minute Time-To-Live (TTL).
- Expired posts are deleted from platforms automatically.
- Instant purge endpoint available: `POST /api/v1/cleanup/purge`.

### 4. Files In, Files Out (Integration Standard 7)
- Ingest files via multipart upload or remote URL: `POST /api/v1/files/upload`.
- Download stored files from S3/local storage: `GET /api/v1/files/:filename`.
- Attached media assets are passed as `feature_image` / `media_urls` to destinations.

### 5. CLI Batch Runner (Integration Standard 10)
Run folders of test payloads against the API and record results to a summary file:
```bash
npm run batch-runner -- ./test_inputs ./test_outputs http://localhost:3000
```

---

## Standard Error Codes

All errors return the standard JSON envelope per Appendix B:

```json
{
  "error": {
    "code": "DEST_RULE_FREQUENCY_CAP",
    "message": "Posting limit exceeded. Frequency cap: 1/week. Next window in 604800s",
    "retryable": true,
    "details": { "retry_after_seconds": 604800 }
  }
}
```

| Error Code | Retry? | Meaning & Platform Action |
|---|---|---|
| `DEST_SPEC_VIOLATION` | No | Content violates destination limits (e.g., title too long, links in body). |
| `DEST_RULE_FREQUENCY_CAP` | Later | Posting limit reached (e.g. 1/week). Reschedule after window. |
| `CONNECTION_AUTH_EXPIRED` | Reconnect | API token or JWT is invalid/expired. Prompt owner to reconnect. |
| `PLATFORM_RATE_LIMIT` | Yes | HTTP 429 received from platform. Exponential backoff using retry-after. |
| `PLATFORM_QUOTA_EXHAUSTED` | Next cycle | Daily platform quota reached. Reschedule for next cycle. |
| `PLATFORM_CONTENT_REJECTED` | No | Community rule violation (e.g. self-promotion banned). |
| `PLATFORM_UNAVAILABLE` | Yes | HTTP 5xx or connection refused. Exponential retry with jitter. |
| `CONNECTOR_DISABLED` | No | Kill switch active for connector. |

---

## Environment Variables (.env)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port for the HTTP connector service |
| `SIMULATION_MODE` | `true` | Enables zero-secret local mock runtime |
| `STORAGE_TYPE` | `local` | `local` or `s3` object storage |
| `STORAGE_LOCAL_DIR` | `./data/storage` | Local directory for uploaded media |
| `GHOST_API_URL` | `http://localhost:2368` | Endpoint for local Ghost container |
| `LEMMY_INSTANCE_URL` | `http://localhost:8536` | Endpoint for local Lemmy container |
| `INCUBRIX_CALLBACK_SECRET` | `incubrix_secret` | Secret key for signing background job callbacks |
