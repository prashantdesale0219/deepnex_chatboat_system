Technical PRD: MERN-Stack Chatbot Backend

**Module:** Chatbot Backend Service

**Version:** 1.0

**Date:** June 13, 2025
**Created For** :- Prashant

---

## 1. Purpose & Overview

Build a standalone backend service for a MERN-stack chatbot application. This service will:

- Expose RESTful APIs for managing configurations and conversations
- Integrate with the Mistral AI API for natural-language understanding and response generation
- Persist data in MongoDB
- Handle authentication, logging, and monitoring

The frontend will be integrated later; this PRD focuses exclusively on backend components.

---

## 2. Objectives

- **Robust API Layer:** CRUD for chatbot configurations, conversation sessions, and message history
- **AI Integration:** Secure, scalable calls to Mistral’s inference endpoints
- **Data Persistence:** Efficient schema design in MongoDB for fast read/write
- **Security & Compliance:** OAuth2/JWT auth, input validation, rate limiting
- **Observability:** Structured logging, metrics, and error tracking

---

## 3. Scope

### In Scope

- Backend service built with Node.js, Express, and react
- MongoDB data models & indexes
- Mistral AI integration module
- API documentation (OpenAPI/Swagger)
- Unit & integration tests
- Dockerization for local dev & production
- CI/CD pipeline configuration

### Out of Scope

- Frontend implementation
- Analytics dashboard (metrics surfaced via external tools)
- Third-party channel adapters (e.g., WhatsApp, Slack)

---

## 4. Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR1 | `POST /api/configs` – Create chatbot configuration (purpose, tone, channels, integrations) | High |
| FR2 | `GET /api/configs/{id}` – Retrieve a configuration | High |
| FR3 | `PUT /api/configs/{id}` – Update configuration | Medium |
| FR4 | `DELETE /api/configs/{id}` – Delete configuration | Low |
| FR5 | `POST /api/sessions` – Start conversation session (returns `sessionId`) | High |
| FR6 | `POST /api/sessions/{sessionId}/messages` – Send user message; returns AI response | High |
| FR7 | `GET /api/sessions/{sessionId}/messages` – Fetch conversation history | Medium |
| FR8 | `POST /api/webhook` – Generic webhook endpoint for external channel integration | Low |
| FR9 | Input validation middleware for all endpoints | High |
| FR10 | Rate limiting: Max 60 requests/min per token | High |
| FR11 | API key / JWT authentication & authorization | High |

---

## 5. Non-Functional Requirements

- **Performance:**
    - 95th percentile response time for non-AI calls < 200 ms
    - Average Mistral API call latency < 500 ms
- **Scalability:**
    - Stateless services; horizontal scaling behind a load balancer
- **Reliability:**
    - 99.9% uptime SLA
- **Security:**
    - TLS everywhere
    - OWASP top 10 mitigations
- **Maintainability:**
    - TypeScript with strict typing
    - ≥ 85% code coverage
- **Deployment:**
    - Docker images stored in private registry
    - Kubernetes deployment manifests or Helm chart

---

## 6. System Architecture

```mermaid
flowchart LR
  subgraph Backend Service
    API[Express API Server]
    Mistral[Mistral AI Client Module]
    Auth[Auth & Rate Limit]
    DB[(MongoDB)]
    Logger[Structured Logger]
  end

  Client →|HTTPS| Auth
  Auth → API
  API → DB
  API → Mistral
  API → Logger
  Mistral →|REST| MistralAI[“Mistral Inference API”]

```

- **Express API Server:** Implements all endpoints, applies middleware
- **Auth & Rate Limit:** Verifies JWT/API keys; enforces quotas
- **Mistral AI Client Module:** Handles request batching, retries, and error handling
- **MongoDB:** Stores configurations, sessions, and messages
- **Logger:** Writes JSON-structured logs to stdout for ingestion by ELK/Prometheus

---

## 7. Data Models

```
// Configurations
interface ChatbotConfig {
  _id: ObjectId;
  name: string;
  purpose: string;
  domain: string[];
  tone: { style: string; language: string };
  channels: string[];
  integrations: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Conversation Sessions
interface Session {
  _id: ObjectId;
  configId: ObjectId;
  userId: string;
  startedAt: Date;
  lastActivity: Date;
}

// Messages
interface Message {
  _id: ObjectId;
  sessionId: ObjectId;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

```

- **Indexes:**
    - `Configurations._id` (default)
    - `Sessions.configId`, `Sessions.userId`
    - `Messages.sessionId`, `Messages.timestamp`

---

## 8. API Specification (Excerpt)

```yaml
openapi: 3.0.1
paths:
  /api/configs:
    post:
      summary: Create configuration
      security:
        - bearerAuth: []
      requestBody:
        content:
          application/json:
            schema: ChatbotConfigInput
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ChatbotConfig'
  /api/sessions/{sessionId}/messages:
    post:
      summary: Send message & get AI response
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                message:
                  type: string
      responses:
        '200':
          description: Bot reply
          content:
            application/json:
              schema:
                type: object
                properties:
                  reply:
                    type: string
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

```

---

## 9. Mistral AI Integration

- **Module:** `mistral-client.ts`
- **Responsibilities:**
    - Accept payload `{ sessionId, messages[] }`
    - Construct Mistral API request with proper auth headers
    - Handle streaming vs. non-streaming responses
    - Retry logic with exponential backoff (up to 3 attempts)
    - Metrics emission for latency & success/failure

---

## 10. Milestones & 30-Day Timeline

| Phase | Days | Deliverables |
| --- | --- | --- |
| **Phase 1: Planning** | 1–3 | Tech spec, API design, schema approvals |
| **Phase 2: Core APIs** | 4–12 | Config & session CRUD, message endpoints |
| **Phase 3: AI Module** | 10–18 | Mistral integration, retry & metrics |
| **Phase 4: Security** | 16–22 | Auth, rate limiting, input validation |
| **Phase 5: Testing** | 20–26 | Unit tests, integration tests, load tests |
| **Phase 6: Deployment** | 25–30 | Docker images, CI/CD, staging rollout |

---

## 11. Success Metrics

- **Functional:**
    - 100% of endpoints pass swagger validation
    - Mistral response success rate ≥ 99%
- **Performance:**
    - 95th percentile latency < 500 ms
- **Reliability:**
    - Automated test coverage ≥ 85%
    - Zero critical bugs in staging

---

## 12. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Mistral API rate limits exceed usage | Implement request queuing & backoff |
| Schema changes break compatibility | Use semantic versioning & migration scripts |
| Unauthorized access to APIs | Enforce strict JWT validation & scopes |
| Performance degradation at scale | Horizontal scaling & caching hot sessions |

---

**End of Technical PRD**

```mermaid
flowchart TD
subgraph SpecModule[Specification Intake Module]
API_Spec[/POST /specifications/]
DB_Spec[(MongoDB: Specifications)]
end
subgraph ConfigModule[Configuration Module]
API_Cfg[/POST, GET, PUT, DELETE /configurations/.../]
DB_Cfg[(MongoDB: ChatbotConfiguration)]
end
subgraph ChatService[Chat Service Module]
API_Chat[/POST /chat/:configId/start, .../message]
SessionStore[(MongoDB: ChatSessions)]
MistralAPI[(Mistral AI REST)]
end
HostApp -->|Define spec & config| API_Spec
HostApp -->|Manage config| API_Cfg
API_Spec --> DB_Spec
API_Cfg --> DB_Cfg
API_Chat --> DB_Cfg
API_Chat --> SessionStore
API_Chat -->|HTTP| MistralAPI
```