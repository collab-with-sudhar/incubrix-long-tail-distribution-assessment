# IncuBrix Assessment 4: Demo Video Recording Runbook (Max 8 Minutes)

This script gives you an exact minute-by-minute plan to record your unedited 8-minute screen recording. Follow these steps sequentially to cover every required element from the brief:

---

## Required Elements (from Brief Page 6)
1. **One clean run** (successful publish to a destination).
2. **One failure and how the system handles it** (rule violation caught by the rules engine).
3. **The tests running** (`npm test` in terminal).
4. **One design decision explained in code** (walk through the idempotency middleware or rules engine).

---

## Minute-by-Minute Recording Plan

### Minute 0:00 - 1:00 | Introduction & Quick Overview
- **Visual:** Open browser to `http://localhost:3000`.
- **Spoken Walkthrough:**
  > "Hi, I am Sudharshan. This is my submission for IncuBrix Assessment 4: Long-Tail Distribution Network. The service is running locally on port 3000 in TypeScript and Node 22 with an Express backend and a minimal React dashboard. Here in the workbench, we have our 6 Core connectors: Discourse, Lemmy, Dev.to, Ghost, Webhook HMAC, and the Assisted tier, plus our 3 Advanced connectors: Hashnode, Slack, and MRSS."

---

### Minute 1:00 - 2:30 | Element 1: One Clean Run (Ghost + Media Upload)
- **Action:**
  1. In the composer, select **Ghost Publisher Publication**.
  2. Type a title: `Announcing Resilient Connectors`.
  3. Type body text: `Building contract-compliant long-tail syndication for technical creators.`
  4. Scroll to **Media Assets & File Upload (Integration Standard 7)**.
  5. Click **Choose File to Upload** and pick a sample image (e.g. from your desktop or downloads).
  6. Point out that the file uploaded immediately, showing its size and storage download link.
  7. Click **Publish to Destination**.
  8. Point out the success card:
     - Shows `live_url`: `http://localhost:2368/...`
     - Shows `job_id` and the JSON manifest with models, timings, and cost estimate ($0.00015).
  9. Click the **View Post** link to show the actual article rendering live in Ghost!

---

### Minute 2:30 - 3:30 | Demonstrate Safe Retries (Idempotency)
- **Action:**
  1. Without editing the post text, click **Publish to Destination** again 2-3 times rapidly.
  2. Point out that the status immediately says:
     - `CACHE HIT · Safe Replay (Must-Have 6 Verified)`.
     - The post ID and live URL are identical.
     - No duplicate post was created on Ghost.

---

### Minute 3:30 - 4:45 | Element 2: One Failure & How the System Handles It
- **Action:**
  1. Switch destination to **Discourse Meta Community** or **Strict Moderated Indie Hackers Community** (both have `self_promo_allowed = false`).
  2. In the composer, toggle **Promotional** to ON.
  3. Click **Publish to Destination**.
  4. Show the immediate rejection banner:
     - Error code: `PLATFORM_CONTENT_REJECTED` (HTTP 422).
     - Message: `Self-promotion is strictly prohibited in Discourse Meta Community`.
     - Explain:
       > "The pre-publish Rules Engine evaluated the rendition before any network call was dispatched, preventing an accidental community rule violation that could get our domain banned."

---

### Minute 4:45 - 5:45 | The 6th Connector: Assisted Tier
- **Action:**
  1. Select **Strict Moderated Indie Hackers Community**.
  2. Toggle Promotional to OFF.
  3. Click **Publish to Destination**.
  4. Click the returned link (`http://localhost:3000/mock/assisted/submit`).
  5. Show the **IncuBrix Assisted Distribution Portal**:
     - Explain:
       > "For communities that ban automated bot scripts, the Assisted connector builds a full Assist Pack containing formatted copy, community guideline checks, and links for human operator submission."
  6. Click "Copy Formatted Text" and "Mark Human Submission Complete".

---

### Minute 5:45 - 6:45 | Element 3: The Tests Running
- **Action:**
  1. Switch window to your PowerShell terminal.
  2. Run the test suite:
     ```powershell
     npm test
     ```
  3. Point out:
     - **6 test suites passed, 55 tests passed (100% pass rate)**.
     - Runs with zero external paid keys in < 4 seconds.
  4. Run the batch runner:
     ```powershell
     npm run batch-runner -- ./test_inputs ./test_outputs http://localhost:3000
     ```
  5. Show that 5 files succeeded and 1 promo violation was cleanly caught and recorded to `batch_summary.json`.

---

### Minute 6:45 - 7:45 | Element 4: One Design Decision Explained in Code
- **Action:**
  1. Open VS Code / editor to [`src/middleware/idempotency.ts`](file:///c:/Users/sudharshan/Documents/Incubrix/src/middleware/idempotency.ts).
  2. Highlight the `waitForCompletion` and `emitter` logic (lines 62–88 & 124–140).
  3. Explain:
     > "Here is our idempotency implementation. Instead of just checking a database after the fact, we use an in-flight lock with Node's EventEmitter. If two identical requests hit the server concurrently within milliseconds, the second request does not launch a duplicate database or network call. It registers an event listener and pauses until the first request completes, then returns the identical cached response. This eliminates race conditions during rapid retries."

---

### Minute 7:45 - 8:00 | Conclusion & Wrap-up
- **Action:**
  1. Switch back to browser.
  2. Show the **Auto-Cleanup** tab with active test posts and click **Purge All Now** to show instant deletion of test posts (Must-Have 5).
  3. Conclude:
     > "All 9 Must-Haves and 10 Integration Standards are implemented, certified, and fully documented in REPORT.md and openapi.yaml. Thank you for reviewing my submission."
