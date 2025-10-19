# C4 Architecture Diagrams for Dorso

This document contains C4 model architecture diagrams for Dorso at different levels of abstraction.

## Level 1: System Context Diagram

Shows how Dorso fits into the larger ecosystem and its external dependencies.

```mermaid
C4Context
  title System Context Diagram for Dorso

  Person(programmer, "Programmer", "Uses AI chatbots for coding assistance")

  System(dorso, "Dorso Browser Extension", "Blocks AI chatbot access until LeetCode problem solved; Tracks user progress and statistics")

  System_Ext(leetcode, "LeetCode Platform", "Programming challenge platform with GraphQL API")
  System_Ext(chatbots, "AI Chatbots", "ChatGPT, Claude, Gemini, Copilot, etc.")

  Rel(programmer, dorso, "Installs and uses")
  Rel(programmer, chatbots, "Attempts to access", "HTTPS")
  Rel(dorso, chatbots, "Blocks/allows access based on session status")
  Rel(dorso, leetcode, "Fetches problems and validates solutions", "GraphQL/HTTPS")
  Rel(programmer, leetcode, "Solves problems to gain chatbot access")

  UpdateRelStyle(dorso, chatbots, $offsetX="-50", $offsetY="-10")
```

**Key Interactions:**
- Users install Dorso extension to enforce programming practice
- Extension intercepts navigation to AI chatbot URLs
- Extension fetches random LeetCode problems via API
- Users solve problems on LeetCode to earn chatbot access
- Extension validates solution submission and grants 15-minute access

---

## Level 2: Container Diagram

Shows the high-level technical building blocks of Dorso.

```mermaid
C4Container
  title Container Diagram for Dorso

  Person(programmer, "Programmer")

  Container_Boundary(extension, "Browser Extension") {
    Container(background, "Background Service Worker", "JavaScript", "Intercepts navigation, manages state, coordinates components")
    Container(popup, "Popup UI", "HTML/CSS/JavaScript", "Displays problems and user stats")
    Container(content, "Content Script", "JavaScript", "Monitors LeetCode submission results")
    Container(shared, "Shared Core Logic", "JavaScript Modules", "Reusable logic for session/question management")
  }

  Container_Boundary(backend, "Backend Infrastructure") {
    Container(django, "Django REST API", "Python 3.11", "Tracks users, sessions, analytics; Serves problems")
    ContainerDb(postgres, "PostgreSQL Database", "SQL Database", "User stats, attempts, sessions, access logs")
    ContainerDb(redis, "Redis Cache", "Key-Value Store", "Active sessions, problem queue, LeetCode API cache")
  }

  Container_Boundary(observability, "Observability Stack") {
    Container(prometheus, "Prometheus", "Metrics DB", "Collects metrics from Django")
    Container(grafana, "Grafana", "Dashboard", "Visualizes metrics and analytics")
  }

  System_Ext(leetcode, "LeetCode GraphQL API")

  Rel(programmer, popup, "Opens extension", "Browser UI")
  Rel(programmer, content, "Solves problem on LeetCode")

  Rel(background, shared, "Uses core logic")
  Rel(popup, shared, "Uses core logic")
  Rel(content, shared, "Uses core logic")

  Rel(background, django, "Syncs session state", "REST/JSON")
  Rel(popup, django, "Fetches problems/stats", "REST/JSON")
  Rel(content, django, "Submits solve events", "REST/JSON")

  Rel(django, postgres, "Reads/writes", "SQL")
  Rel(django, redis, "Caches data", "Redis protocol")
  Rel(django, leetcode, "Fetches problems", "GraphQL/HTTPS")

  Rel(django, prometheus, "Exports metrics")
  Rel(grafana, prometheus, "Queries metrics")

  UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="2")
```

**Container Responsibilities:**

**Extension:**
- **Background Service Worker**: Core orchestration, navigation interception, state management
- **Popup UI**: User interface for viewing problems and statistics
- **Content Script**: Detects LeetCode submission results via DOM monitoring
- **Shared Core Logic**: Browser-agnostic business logic (80% code reuse)

**Backend:**
- **Django REST API**: User tracking, session management, problem serving, analytics
- **PostgreSQL**: Persistent storage for users, attempts, sessions, access logs
- **Redis**: High-speed caching for active sessions and problem queue

**Observability:**
- **Prometheus**: Metrics collection (solve rates, API latency, etc.)
- **Grafana**: Real-time dashboard visualization

---

## Level 3: Component Diagram - Shared Core Logic

Shows internal components of the shared JavaScript module.

```mermaid
C4Component
  title Component Diagram - Shared Core Module

  Container_Boundary(shared, "Shared Core Logic") {
    Component(questionMgr, "QuestionManager", "JavaScript Class", "Fetches and caches LeetCode problems")
    Component(sessionMgr, "SessionManager", "JavaScript Class", "Manages 15-min session lifecycle")
    Component(backendClient, "BackendClient", "JavaScript Class", "API client for Django backend")
    Component(logger, "Logger", "JavaScript Singleton", "Structured logging utility")
    Component(validator, "Validator", "JavaScript Functions", "Input validation and sanitization")
    Component(constants, "Constants", "JavaScript Module", "Shared configuration and blacklist")

    Component_Ext(chromeAdapter, "ChromeStorageAdapter", "Storage abstraction for Chrome")
    Component_Ext(firefoxAdapter, "FirefoxStorageAdapter", "Storage abstraction for Firefox")
  }

  Container_Ext(background, "Background Service Worker")
  Container_Ext(popup, "Popup UI")
  Container_Ext(django, "Django REST API")
  Container_Ext(leetcode, "LeetCode API")
  ContainerDb_Ext(browserStorage, "Browser Storage API")

  Rel(background, questionMgr, "Gets random problems")
  Rel(background, sessionMgr, "Checks session status")
  Rel(popup, sessionMgr, "Displays session info")

  Rel(questionMgr, backendClient, "Fetches from backend API")
  Rel(questionMgr, leetcode, "Fallback: Direct fetch", "GraphQL")
  Rel(sessionMgr, backendClient, "Syncs session state")

  Rel(backendClient, django, "HTTP requests", "REST/JSON")

  Rel(sessionMgr, chromeAdapter, "Uses for Chrome")
  Rel(sessionMgr, firefoxAdapter, "Uses for Firefox")
  Rel(chromeAdapter, browserStorage, "chrome.storage.local")
  Rel(firefoxAdapter, browserStorage, "browser.storage.local")

  Rel(questionMgr, logger, "Logs operations")
  Rel(sessionMgr, logger, "Logs session events")
  Rel(backendClient, logger, "Logs API calls")

  Rel(questionMgr, validator, "Validates problem data")
  Rel(backendClient, constants, "Uses API URLs")

  UpdateLayoutConfig($c4ShapeInRow="3")
```

**Component Responsibilities:**

1. **QuestionManager**:
   - Fetches problems from backend (preferred) or LeetCode (fallback)
   - Caches problem data locally (7-day TTL)
   - Validates problem structure

2. **SessionManager**:
   - Tracks 15-minute session duration
   - Checks local & backend for active sessions (offline-first)
   - Starts/ends sessions based on solve events

3. **BackendClient**:
   - Centralizes all HTTP communication with Django
   - Handles user registration, problem submission, analytics logging
   - Implements error handling and retries

4. **Logger**:
   - Structured logging with context (timestamp, level, component)
   - Sends ERROR logs to backend for monitoring

5. **Validator**:
   - Input validation (problem data, URLs, session data)
   - HTML sanitization for security

6. **Storage Adapters**:
   - Abstract browser-specific storage APIs (Chrome vs Firefox)
   - Enable shared code to work across browsers

---

## Level 3: Component Diagram - Django Backend

Shows internal structure of the Django REST API.

```mermaid
C4Component
  title Component Diagram - Django REST API

  Container_Boundary(django, "Django REST API") {
    Component(trackingViews, "Tracking Views", "DRF ViewSets", "User registration, session checks, access logging")
    Component(problemViews, "Problem Views", "DRF APIViews", "Random problem fetching, solution submission")
    Component(trackingModels, "Tracking Models", "Django ORM", "ExtensionUser, ProblemAttempt, UserSession, AccessLog")
    Component(problemService, "LeetCode Service", "Python Class", "Fetches and caches problems from LeetCode API")
    Component(queueService, "Problem Queue Service", "Python Class", "Maintains Redis queue of pre-fetched problems")
    Component(serializers, "DRF Serializers", "Serializers", "Request/response validation and transformation")
    Component(signals, "Django Signals", "Signal Handlers", "Auto-create sessions on solve, update streaks")
    Component(metrics, "Prometheus Metrics", "Counters/Histograms", "Track solve rates, API latency")
  }

  ContainerDb_Ext(postgres, "PostgreSQL")
  ContainerDb_Ext(redis, "Redis")
  Container_Ext(extension, "Browser Extension")
  System_Ext(leetcode, "LeetCode API")

  Rel(extension, trackingViews, "POST /users/register/")
  Rel(extension, trackingViews, "GET /users/check-session/")
  Rel(extension, problemViews, "GET /problems/random/")
  Rel(extension, problemViews, "POST /problems/submit/")

  Rel(trackingViews, serializers, "Validates data")
  Rel(problemViews, serializers, "Validates data")

  Rel(trackingViews, trackingModels, "CRUD operations")
  Rel(problemViews, trackingModels, "Creates ProblemAttempt")

  Rel(problemViews, problemService, "Gets random problem")
  Rel(problemViews, queueService, "Pops from queue")

  Rel(problemService, leetcode, "GraphQL query", "HTTPS")
  Rel(problemService, redis, "Caches problems (7d TTL)")
  Rel(queueService, redis, "Manages problem queue")

  Rel(trackingModels, postgres, "Persists data", "Django ORM")
  Rel(trackingModels, signals, "Triggers on save")

  Rel(signals, trackingModels, "Updates UserSession, streaks")

  Rel(trackingViews, metrics, "Increments counters")
  Rel(problemViews, metrics, "Records latency")

  UpdateLayoutConfig($c4ShapeInRow="3")
```

**Component Responsibilities:**

1. **Tracking Views**: REST endpoints for user management and analytics
2. **Problem Views**: REST endpoints for problem fetching and submission
3. **Tracking Models**: ORM models with business logic (streak calculation, session expiry)
4. **LeetCode Service**: Fetches problems from GraphQL API with caching
5. **Problem Queue Service**: Maintains Redis queue of 20 pre-fetched problems for low latency
6. **Serializers**: Input validation, output formatting, custom error handling
7. **Signals**: Event-driven updates (auto-create session on solve, update stats)
8. **Prometheus Metrics**: Exports metrics for observability dashboard

---

## Data Flow: Successful Problem Solve

```mermaid
sequenceDiagram
    actor User
    participant Popup as Popup UI
    participant Background as Background Worker
    participant Content as Content Script
    participant Shared as Shared Core
    participant Django as Django API
    participant Redis
    participant Postgres as PostgreSQL

    User->>Background: Tries to access chatgpt.com
    Background->>Shared: sessionMgr.hasActiveSession()
    Shared->>Django: GET /users/check-session/
    Django->>Redis: Check active session
    Redis-->>Django: No active session
    Django-->>Shared: {has_active_session: false}
    Background->>Popup: Redirect to extension popup

    User->>Popup: Opens popup
    Popup->>Shared: questionMgr.getRandomProblem()
    Shared->>Django: GET /problems/random/
    Django->>Redis: Pop problem from queue
    Redis-->>Django: Problem slug
    Django->>Redis: Get cached problem data
    Redis-->>Django: Problem details
    Django-->>Shared: Problem JSON
    Popup-->>User: Display problem

    User->>Popup: Click "TRY QUESTION"
    Popup->>Background: openLeetCodeQuestion(slug)
    Background-->>User: Open LeetCode tab

    User->>User: Solves problem on LeetCode
    User->>User: Submits solution

    Content->>Content: Detect "Accepted" via DOM
    Content->>Background: submissionResult(success=true)

    Background->>Shared: sessionMgr.startSession(data)
    Shared->>Django: POST /problems/submit/
    Django->>Postgres: Create ProblemAttempt (solved=true)
    Postgres-->>Django: Attempt saved

    Note over Django: Signal triggers
    Django->>Django: Update user stats (solves, streak)
    Django->>Postgres: Update ExtensionUser
    Django->>Postgres: Create UserSession (15 min)
    Django->>Redis: Cache active session

    Django-->>Shared: {success: true, session_expires: ...}
    Shared->>Background: Store session locally
    Background->>Popup: updatePopup("Success!")

    User->>Background: Navigate to chatgpt.com
    Background->>Shared: sessionMgr.hasActiveSession()
    Shared-->>Background: true
    Background-->>User: Allow access to ChatGPT
```

---

## Deployment Architecture

```mermaid
C4Deployment
  title Deployment Diagram - Dorso in Production

  Deployment_Node(user_machine, "User Machine", "Desktop/Laptop") {
    Deployment_Node(browser, "Web Browser", "Chrome/Firefox") {
      Container(extension, "Dorso Extension", "Monitors navigation, manages sessions")
    }
  }

  Deployment_Node(docker_host, "Docker Host", "Production Server") {
    Deployment_Node(docker, "Docker Compose") {
      Container(django_container, "Django Backend", "Gunicorn + Django")
      ContainerDb(postgres_container, "PostgreSQL", "Database")
      ContainerDb(redis_container, "Redis", "Cache")
      Container(prometheus_container, "Prometheus", "Metrics")
      Container(grafana_container, "Grafana", "Dashboards")
    }
  }

  System_Ext(leetcode_cloud, "LeetCode API", "leetcode.com")

  Rel(extension, django_container, "HTTPS API calls", "Port 8000")
  Rel(django_container, postgres_container, "SQL", "Port 5432")
  Rel(django_container, redis_container, "Redis protocol", "Port 6379")
  Rel(django_container, leetcode_cloud, "GraphQL/HTTPS")
  Rel(prometheus_container, django_container, "Scrape /metrics")
  Rel(grafana_container, prometheus_container, "Query metrics")
```

**Infrastructure:**
- **User Machine**: Browser extension runs locally
- **Docker Host**: All backend services containerized
- **PostgreSQL**: Persistent data storage
- **Redis**: Session cache and problem queue
- **Prometheus + Grafana**: Observability stack

---

## Technology Choices & Trade-offs

| Decision | Choice | Rationale | Trade-off |
|----------|--------|-----------|-----------|
| **Backend Framework** | Django + DRF | Batteries-included (ORM, admin, migrations), rapid development | Heavier than FastAPI, but feature-rich |
| **Database** | PostgreSQL | Relational data model fits analytics queries, ACID guarantees | More complex than SQLite, but production-ready |
| **Cache** | Redis | Sub-ms session lookups, persistent cache, data structures (lists for queue) | Requires separate service vs in-memory cache |
| **Code Sharing** | Shared JS module + adapters | 80% code reuse between Chrome/Firefox | Adds abstraction layer complexity |
| **Problem Fetching** | Backend API (Django) with Redis queue | Centralized caching, analytics, pre-fetching reduces latency | Extension offline mode requires fallback |
| **Session Storage** | Hybrid (local + backend) | Offline-first UX, backend as source of truth | Requires sync logic |

---

## Security Considerations

1. **No User Authentication**: Extension users identified by runtime ID only (privacy-preserving)
2. **CORS Configuration**: Only allows chrome-extension:// and moz-extension:// origins
3. **Input Validation**: All API inputs validated via Pydantic/DRF serializers
4. **HTML Sanitization**: LeetCode problem content sanitized before rendering
5. **No Secrets in Code**: Environment variables for sensitive config
6. **HTTPS Only**: All external API calls use HTTPS
7. **Rate Limiting**: DRF throttling prevents API abuse (1000 req/hour)

---

These diagrams provide multiple levels of abstraction to explain Dorso's architecture during technical interviews, demonstrating understanding of:
- System design principles (separation of concerns, abstraction)
- Scalability patterns (caching, queueing)
- Production best practices (observability, security)
- Modern tech stack (Django, Redis, Docker, Prometheus)
