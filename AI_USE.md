# AI_USE.md — Disclosure of AI Tooling & Usage

In compliance with IncuBrix Assessment 4 rules and rights disclosure, this document outlines how AI coding assistants and models were utilized throughout the development of this project.

## 1. AI Tools Used

| Tool / Model | Version / Provider | Scope of Usage |
|--------------|-------------------|----------------|
| **Antigravity AI Pair Programmer** | Google DeepMind / Claude 3.5 / Gemini 2.0 | Architectural planning, code scaffolding, test generation, and documentation drafting |

## 2. Specific Tasks Delegated to AI

1. **Architecture & Contract Scaffolding**:
   - Mapped the IncuBrix Appendix A specification (TypeScript Node 20+ contract) to Express.js routes and TypeScript interfaces.
   - Designed the connector manifest schema and BaseConnector abstract class.

2. **Rules Engine Design**:
   - Generated the parsing and validation logic for destination policies: frequency caps (e.g. `1/week`), self-promotion prevention, outbound link policies, and AI disclosure auto-tagging.

3. **Test Suite Generation**:
   - Scaffolded contract tests, unit tests for edge cases (hard cases), and end-to-end integration tests using Jest and Supertest.

4. **Integration Standard Compliance**:
   - Structured JSON logging with automated secret token masking (`[REDACTED_SECRET]`).
   - Idempotency middleware ensuring replay semantics without double-posting.
   - OpenAPI 3.1 schema specification (`openapi.yaml`).

## 3. Human Review & Verification

All architecture, business logic, connector implementations, error mapping, and test assertions were reviewed, understood, and validated by the candidate. The candidate is prepared to explain every design choice and code path in detail during the live technical walkthrough.
