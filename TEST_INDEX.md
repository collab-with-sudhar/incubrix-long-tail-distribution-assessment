# IncuBrix Assessment 4: Test Pack & Verification Index

This index links every requirement, claim, and hard case in `REPORT.md` and `Assessment_4_Sudharshanan.xlsx` to the exact test files, inputs, outputs, and evidence in the repository.

---

## 1. Must-Haves Verification Index

| Requirement | Claim in Report | Primary Code File | Test & Verification Proof |
|---|---|---|---|
| **Must-Have 1** (Unified Contract) | All connectors implement the 7 Appendix A methods and standard error codes | `src/types/contract.ts`<br>`src/connectors/base.ts` | `tests/contract/connectors.test.ts` (14 contract assertions) |
| **Must-Have 2** (6 Core Connectors) | Discourse, Lemmy, Dev.to, Ghost, Webhook HMAC, and Assisted certified | `src/connectors/*.ts` | `data/certification/*_evidence.json`<br>`npm run test:certification` |
| **Must-Have 3** (Configuration, Not Code) | Adding a destination requires only a catalogue row without code edits | `src/catalogue/store.ts`<br>`src/routes/api.v1.ts` | `tests/e2e/api.test.ts`<br>`POST /api/v1/destinations` |
| **Must-Have 4** (Posting Rules Engine) | Enforces frequency caps, promo bans, link policies, and AI disclosure | `src/rules/engine.ts` | `tests/unit/rules.test.ts`<br>`test_inputs/03_rule_violation_promo.json` |
| **Must-Have 5** (10-Min Cleanup Reaper) | All test posts auto-deleted within 10 min; instant purge API | `src/cleanup/reaper.ts` | `tests/unit/reaper.test.ts`<br>`POST /api/v1/cleanup/purge` |
| **Must-Have 6** (Safe Retries & Idempotency) | Same Idempotency-Key replays cached post; zero duplicates under retry | `src/middleware/idempotency.ts` | `tests/unit/idempotency.test.ts` (rapid multi-press & in-flight locks) |
| **Must-Have 7** (Zero Secrets & Simulation) | All sensitive tokens scrubbed in logs; runs without paid external keys | `src/utils/logger.ts`<br>`.env.example` | `.env.example`<br>`src/routes/mock.ts` |
| **Must-Have 8** (Local Test Instances) | One command starts service, Ghost, Lemmy, Redis, and Postgres | `docker-compose.yml` | `docker-compose.yml`<br>`GET /health` |
| **Must-Have 9** (Integration Standards) | Follows all 10 Integration Standards with OpenAPI 3.1 documentation | `openapi.yaml`<br>`src/server.ts` | `openapi.yaml`<br>`tests/e2e/api.test.ts` |

---

## 2. Advanced Level Features Index

| Feature | Claim in Report | Implementation | Test & Benchmark Proof |
|---|---|---|---|
| **Catalogue Import Benchmark** | 1,000 destinations imported in under 5 minutes with deduplication | `src/catalogue/importer.ts` | `tests/unit/advanced.test.ts`<br>**Measured: 21 milliseconds (47,619 rows/sec)** |
| **AI Rules Extraction** | Community guidelines parsed into rules with human review step | `src/rules/ai_capture.ts` | `tests/unit/advanced.test.ts`<br>`POST /api/v1/rules/capture` |
| **Audience Relevance Scorer** | 1 to 5 relevance score with auditable explanation per destination | `src/rules/relevance.ts` | `tests/unit/advanced.test.ts`<br>`POST /api/v1/catalogue/score-relevance` |
| **Content Tailoring Engine** | Adapts title, discussion framing, and word-boundary truncation | `src/tailoring/engine.ts` | `tests/unit/advanced.test.ts`<br>`POST /api/v1/content/tailor` |
| **Advanced Connectors** | Hashnode (GraphQL), Slack (Webhooks), and MRSS (XML Feed) | `src/connectors/hashnode.ts`<br>`src/connectors/slack.ts`<br>`src/connectors/mrss.ts` | `tests/unit/advanced.test.ts`<br>`data/certification/hashnode_evidence.json`<br>`data/certification/slack_evidence.json`<br>`data/certification/mrss_evidence.json` |

---

## 3. Integration Standards (10 Points) Index

| Point | Standard | Implementation File | Verification Command / Output |
|---|---|---|---|
| **1** | One-command start & test | `docker-compose.yml`, `.env.example` | `npm test` (Runs all 55 tests without API keys) |
| **2** | Documented HTTP API | `openapi.yaml` | OpenAPI 3.1.0 compliant; covers all 17 routes |
| **3** | Background jobs (> 2s) | `src/jobs/manager.ts`, `src/routes/api.v1.ts` | Auto-promotes requests > 2s to 202 Accepted; HMAC callback signing |
| **4** | Safe retries | `src/middleware/idempotency.ts` | `tests/unit/idempotency.test.ts` |
| **5** | Clear errors | `src/middleware/errorHandler.ts` | `{"error": {"code", "message", "retryable", "details"}}` |
| **6** | Configuration | `.env.example`, `process.env` | Zero hard-coded paths or credentials |
| **7** | Files in, files out | `src/storage/service.ts`, `src/routes/api.v1.ts` | `POST /api/v1/files/upload`, `GET /api/v1/files/:filename` |
| **8** | Logs and health | `src/utils/logger.ts`, `src/server.ts` | Structured JSON logs; `GET /health` & `GET /ready` |
| **9** | Output manifest | `src/routes/api.v1.ts` | Manifest with models, settings, seed: 42, timings, cost |
| **10** | Batch runner | `src/scripts/batch_runner.ts` | `test_inputs/` -> `test_outputs/batch_summary.json` |

---

## 4. Batch Test Pack Outputs Summary

The batch runner processed the `test_inputs/` directory against `http://localhost:3000` with the following recorded results:

- `test_inputs/01_discourse_discussion.json` $\rightarrow$ `test_outputs/01_discourse_discussion_result.json` (**SUCCESS**: Topic created on Discourse)
- `test_inputs/02_devto_technical_post.json` $\rightarrow$ `test_outputs/02_devto_technical_post_result.json` (**SUCCESS**: Article published on Dev.to)
- `test_inputs/03_rule_violation_promo.json` $\rightarrow$ `test_outputs/03_rule_violation_promo_result.json` (**REJECTED**: Blocked with `PLATFORM_CONTENT_REJECTED` per community self-promotion ban)
- `test_inputs/04_ghost_publication.json` $\rightarrow$ `test_outputs/04_ghost_publication_result.json` (**SUCCESS**: Ghost article created with slug URL)
- `test_inputs/05_webhook_syndication.json` $\rightarrow$ `test_outputs/05_webhook_syndication_result.json` (**SUCCESS**: Webhook event signed with SHA256 HMAC)
- `test_inputs/06_assisted_community_post.json` $\rightarrow$ `test_outputs/06_assisted_community_post_result.json` (**SUCCESS**: Assist Pack assembled for manual submission at `/mock/assisted/submit`)
- **Overall Summary**: `test_outputs/batch_summary.json` (5 succeeded, 1 rule rejection caught).
