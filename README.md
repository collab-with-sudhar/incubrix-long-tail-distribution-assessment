# IncuBrix Distribution: Long-Tail Destination Network

[![Node](https://img.shields.io/badge/Node-20%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com)
[![Tests](https://img.shields.io/badge/Tests-37%2F37%20Passing-brightgreen.svg)]()

> A robust, contract-compliant connector runtime and posting rules engine designed for IncuBrix Distribution to syndicate content across developer blogs, forums, federated networks, and partner websites without spamming.

---

## 🏛️ Architecture Overview

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
                               |  - Idempotency Safe Retry Store     |
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
         +-----------------+----------------------+-----------------+-----------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               |    Local Sandboxes / Mocks / APIs   |
                               |  Ghost Blog (2368)  Lemmy (8536)    |
                               +-------------------------------------+
```

---

## 🚀 Quickstart in Under 5 Commands

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd incubrix-distribution-service
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run All Automated Tests (No API keys required)
```bash
npm test
```
*Executes unit, contract, idempotency, and end-to-end tests in simulation mode.*

### 4. Run Certification on All 6 Core Connectors
```bash
npm run test:certification
```
*Verifies validate -> publish -> confirm status -> metrics -> deletion cleanup and writes evidence.*

### 5. Run the Service
```bash
# Development mode with hot-reload
npm run dev

# Or using Docker Compose for complete local ecosystem (Ghost, Lemmy, MinIO, Redis)
docker compose up -d
```

---

## 📋 Standard Shared Error Codes

All errors are returned in standard JSON format:
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

| Error Code | Retry? | Meaning & Expected Action |
|------------|--------|---------------------------|
| `DEST_SPEC_VIOLATION` | No | Content exceeds destination limits (e.g. title too long, outbound links in restricted field). |
| `DEST_RULE_FREQUENCY_CAP` | Later | Destination frequency cap reached (e.g. 1 post/week). Reschedule after window. |
| `CONNECTION_AUTH_EXPIRED` | After reconnect | API token or JWT is expired/revoked. Pause and prompt owner to reconnect. |
| `PLATFORM_RATE_LIMIT` | Yes | HTTP 429 received from platform. Exponential backoff using platform reset time. |
| `PLATFORM_QUOTA_EXHAUSTED` | Next window | Platform daily quota exhausted. Reschedule for next quota cycle. |
| `PLATFORM_CONTENT_REJECTED` | No | Community or platform rejected content (e.g. self-promotion violations). |
| `PLATFORM_UNAVAILABLE` | Yes | HTTP 5xx or network timeout. Exponential retry; circuit breaker after 5 failures. |
| `CONNECTOR_DISABLED` | No | Kill switch active for this connector. |

---

## 📦 Batch Runner CLI Tool (Integration Standard 10)

Process batches of test inputs against the running connector service:

```bash
npm run batch-runner -- ./test_inputs ./test_outputs http://localhost:3000
```

Results and a `batch_summary.json` report are saved to the designated output folder.

---

## 🧪 Hard Cases Tested

1. **Timeout & Retry with Same Idempotency Key**: Guarantees zero duplicate posts.
2. **Rate Limit 429**: Mapped to `PLATFORM_RATE_LIMIT` with retry window.
3. **Expired Auth Token**: Catches invalid credentials and maps to `CONNECTION_AUTH_EXPIRED`.
4. **Specification Violations**: Rejects oversized titles and payloads with field-level reasons (`DEST_SPEC_VIOLATION`).
5. **Frequency Cap Window**: Blocks second post within weekly cap, returning `DEST_RULE_FREQUENCY_CAP`.
6. **No Self-Promotion Rule**: Blocks promotional content to strict communities (`PLATFORM_CONTENT_REJECTED`).
7. **Mandatory AI Disclosure**: Automatically verifies and appends compliant AI disclosure notes.
