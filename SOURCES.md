# SOURCES.md — Third-Party Sources & Dependencies

All libraries, frameworks, tools, and dependencies used in this submission are licensed for commercial use (MIT, Apache-2.0, BSD-3-Clause). No AGPL or non-commercial (CC BY-NC) code is included in the shipped service.

## 1. Runtime Frameworks & Libraries

| Package | Version | Licence | Purpose | Source |
|---------|---------|---------|---------|--------|
| **Node.js** | >= 20.0 | MIT | JavaScript runtime engine | https://nodejs.org |
| **Express.js** | ^4.21.2 | MIT | Core HTTP web framework & routing | https://expressjs.com |
| **TypeScript** | ^5.7.3 | Apache-2.0 | Type system and static analysis | https://www.typescriptlang.org |
| **Axios** | ^1.7.9 | MIT | HTTP client for external destination APIs | https://axios-http.com |
| **CORS** | ^2.8.5 | MIT | Cross-origin resource sharing middleware | https://github.com/expressjs/cors |
| **dotenv** | ^16.4.7 | BSD-2-Clause | Environment configuration manager | https://github.com/motdotla/dotenv |
| **js-yaml** | ^4.1.0 | MIT | YAML parser for connector manifests | https://github.com/nodeca/js-yaml |
| **multer** | ^1.4.5-lts.1 | MIT | Multipart form file upload middleware | https://github.com/expressjs/multer |
| **zod** | ^3.24.2 | MIT | Schema declaration and contract validation | https://zod.dev |
| **uuid** | ^11.0.5 | MIT | UUID generation for jobs & idempotency | https://github.com/uuidjs/uuid |
| **supertest** | ^7.0.0 | MIT | HTTP integration testing utility | https://github.com/ladjs/supertest |
| **Jest** | ^29.7.0 | MIT | Test runner and assertion library | https://jestjs.io |
| **ts-jest** | ^29.2.5 | MIT | TypeScript preprocessor for Jest | https://github.com/kulshekhar/ts-jest |
| **tsx** | ^4.19.2 | MIT | TypeScript execution & hot reloading | https://github.com/privatenumber/tsx |

## 2. Infrastructure & Local Test Containers

| Container Image | Licence | Purpose |
|-----------------|---------|---------|
| **node:22-alpine** | MIT / Alpine | Production container base image |
| **ghost:5-alpine** | MIT | Real local Ghost blog instance for end-to-end testing |
| **dessalines/lemmy:0.19.5** | AGPL-3.0 (test container only, not in shipped service) | Local Lemmy federated community instance |
| **postgres:15-alpine** | PostgreSQL Licence | Database for local Lemmy instance |
| **minio/minio:latest** | AGPL-3.0 (standalone service container) | Local S3-compatible object storage |
| **redis:7-alpine** | BSD-3-Clause | Cache and idempotency key store |

## 3. Platform APIs Referenced

- **Ghost Admin API v5**: https://ghost.org/docs/admin-api/
- **Lemmy HTTP API v3**: https://join-lemmy.org/api/index.html
- **Forem / Dev.to API**: https://developers.forem.com/api/v1
- **Discourse REST API**: https://docs.discourse.org/
- **OpenAPI 3.1 Specification**: https://spec.openapis.org/oas/v3.1.0
