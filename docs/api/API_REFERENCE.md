# Dorso Backend API Reference

Base URL: `http://localhost:8000/api/v1` (development)

All endpoints accept and return JSON unless otherwise specified.

---

## User Management

### Register Extension User

Register a new extension installation or update an existing user's last_active timestamp.

**Endpoint:** `POST /users/register/`

**Request Body:**
```json
{
  "extension_id": "chrome-runtime-id-abc123",
  "browser": "chrome"  // Options: "chrome", "firefox", "edge", "other"
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "extension_id": "chrome-runtime-id-abc123",
  "browser": "chrome",
  "first_seen": "2025-01-15T10:30:00Z",
  "last_active": "2025-01-15T10:30:00Z",
  "total_solves": 0,
  "current_streak": 0,
  "longest_streak": 0,
  "total_attempts": 0,
  "is_active": true,
  "has_active_session": false,
  "active_session_expires": null
}
```

---

### Check Session Status

Check if a user has an active 15-minute session.

**Endpoint:** `GET /users/check-session/`

**Query Parameters:**
- `extension_id` (required): User's extension ID

**Response:** `200 OK`
```json
{
  "has_active_session": true,
  "extension_id": "chrome-runtime-id-abc123",
  "session_expires": "2025-01-15T10:45:00Z",
  "session_id": 42
}
```

**Error Response:** `404 Not Found`
```json
{
  "has_active_session": false,
  "error": "User not found. Please register first."
}
```

---

### Get User Statistics

Retrieve detailed statistics for a user.

**Endpoint:** `GET /users/{extension_id}/stats/`

**Response:** `200 OK`
```json
{
  "extension_id": "chrome-runtime-id-abc123",
  "total_solves": 25,
  "total_attempts": 40,
  "current_streak": 3,
  "longest_streak": 7,
  "solve_rate": 62.5,
  "favorite_difficulty": "Medium",
  "recent_attempts": [
    {
      "id": 100,
      "problem_slug": "two-sum",
      "problem_title": "Two Sum",
      "difficulty": "Easy",
      "attempted_at": "2025-01-15T09:00:00Z",
      "solved": true,
      "time_taken_seconds": 420
    }
    // ... up to 10 recent attempts
  ]
}
```

---

### Log Chatbot Access

Log when a user accesses an AI chatbot (analytics).

**Endpoint:** `POST /users/log-access/`

**Request Body:**
```json
{
  "user": 1,  // ExtensionUser ID or extension_id
  "chatbot_url": "https://chatgpt.com/",
  "chatbot_name": "ChatGPT",
  "problem_solved_for_access": 42  // Optional: ProblemAttempt ID
}
```

**Response:** `201 Created`
```json
{
  "id": 15,
  "user": 1,
  "chatbot_url": "https://chatgpt.com/",
  "chatbot_name": "ChatGPT",
  "accessed_at": "2025-01-15T10:35:00Z",
  "problem_solved_for_access": 42
}
```

---

## Problem Management

### Get Random Problem

Fetch a random LeetCode problem.

**Endpoint:** `GET /problems/random/`

**Response:** `200 OK`
```json
{
  "id": "1",
  "title": "Two Sum",
  "slug": "two-sum",
  "content": "<p>Given an array of integers...</p>",
  "difficulty": "Easy",
  "exampleTestcases": "[2,7,11,15]\n9"
}
```

**Error Response:** `503 Service Unavailable`
```json
{
  "error": "Failed to fetch problem. Please try again."
}
```

---

### Get Problem by Slug

Fetch a specific problem by its LeetCode slug.

**Endpoint:** `GET /problems/{slug}/`

**Example:** `GET /problems/two-sum/`

**Response:** `200 OK`
```json
{
  "id": "1",
  "title": "Two Sum",
  "slug": "two-sum",
  "content": "<p>Given an array of integers...</p>",
  "difficulty": "Easy",
  "exampleTestcases": "[2,7,11,15]\n9"
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": "Problem \"invalid-slug\" not found."
}
```

---

### Submit Solved Problem

Submit a successfully solved problem to start a new session.

**Endpoint:** `POST /problems/submit/`

**Request Body:**
```json
{
  "extension_id": "chrome-runtime-id-abc123",
  "problem_slug": "two-sum",
  "problem_title": "Two Sum",
  "difficulty": "Easy",
  "time_taken_seconds": 420  // Optional
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Problem solved! You now have access to AI chatbots.",
  "session_expires": "2025-01-15T10:45:00Z",
  "total_solves": 1,
  "current_streak": 1
}
```

**Side Effects:**
- Creates `ProblemAttempt` record with `solved=True`
- Creates `UserSession` with 15-minute duration
- Updates `ExtensionUser.total_solves` and `current_streak`
- Triggers Django signal for analytics

---

### Log Problem Attempt

Log a failed or in-progress problem attempt.

**Endpoint:** `POST /problems/attempt/`

**Request Body:**
```json
{
  "extension_id": "chrome-runtime-id-abc123",
  "problem_slug": "median-of-two-sorted-arrays",
  "problem_title": "Median of Two Sorted Arrays",
  "difficulty": "Hard"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Attempt logged."
}
```

**Side Effects:**
- Creates `ProblemAttempt` record with `solved=False`
- Increments `ExtensionUser.total_attempts`

---

## Health & Monitoring

### Health Check

Simple health check endpoint for load balancers.

**Endpoint:** `GET /health/`

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "service": "dorso-api",
  "version": "2.0.0"
}
```

---

### Prometheus Metrics

Prometheus-compatible metrics endpoint.

**Endpoint:** `GET /metrics`

**Response:** `200 OK` (Prometheus text format)
```
# HELP dorso_user_registrations_total Total number of extension user registrations
# TYPE dorso_user_registrations_total counter
dorso_user_registrations_total{browser="chrome"} 150.0
dorso_user_registrations_total{browser="firefox"} 75.0

# HELP dorso_problems_solved_total Total number of problems solved
# TYPE dorso_problems_solved_total counter
dorso_problems_solved_total{difficulty="Easy"} 500.0
dorso_problems_solved_total{difficulty="Medium"} 300.0
dorso_problems_solved_total{difficulty="Hard"} 100.0

# HELP dorso_api_request_duration_seconds API request duration
# TYPE dorso_api_request_duration_seconds histogram
dorso_api_request_duration_seconds_bucket{endpoint="/problems/random/",le="0.1"} 450.0
dorso_api_request_duration_seconds_bucket{endpoint="/problems/random/",le="0.5"} 490.0
...
```

---

## Error Responses

All API errors follow this format:

```json
{
  "error": true,
  "message": "Human-readable error message",
  "details": {
    "field_name": ["Validation error details"]
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET request |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid input data |
| 404 | Not Found | Resource doesn't exist |
| 503 | Service Unavailable | External API (LeetCode) failed |

---

## Rate Limiting

**Limit:** 1000 requests per hour per IP address (anonymous users)

**Response when rate limited:** `429 Too Many Requests`
```json
{
  "detail": "Request was throttled. Expected available in 3600 seconds."
}
```

---

## CORS Policy

The API accepts requests from:
- `chrome-extension://*` (Chrome extensions)
- `moz-extension://*` (Firefox extensions)
- `localhost` (development only)

Requests from other origins will be blocked with a CORS error.

---

## Caching Strategy

### Redis Cache Keys

- **Active Sessions**: `dorso:session:<extension_id>` (TTL: 900s / 15 min)
- **LeetCode Problems**: `dorso:leetcode_problem:<slug>` (TTL: 604800s / 7 days)
- **Problem Queue**: `dorso:problem_queue` (Persistent list)

### Cache Behavior

1. **Session Checks**: Always check Redis first, fall back to PostgreSQL
2. **Problem Fetching**: Check Redis → Backend queue → LeetCode API
3. **Problem Queue**: Automatically refills when <5 problems remain

---

## Example Workflows

### Workflow 1: First-Time User

```javascript
// 1. Register user
POST /users/register/
{ "extension_id": "new-user-123", "browser": "chrome" }

// 2. Get random problem
GET /problems/random/

// 3. User solves problem, submit
POST /problems/submit/
{
  "extension_id": "new-user-123",
  "problem_slug": "two-sum",
  "problem_title": "Two Sum",
  "difficulty": "Easy",
  "time_taken_seconds": 600
}

// 4. Check session status
GET /users/check-session/?extension_id=new-user-123
// Response: { "has_active_session": true, ... }
```

### Workflow 2: Returning User

```javascript
// 1. Check if session still active
GET /users/check-session/?extension_id=existing-user
// Response: { "has_active_session": false }

// 2. Get new problem
GET /problems/random/

// 3. Log attempt (if user fails)
POST /problems/attempt/
{ "extension_id": "existing-user", "problem_slug": "...", ... }

// 4. Eventually solve and submit
POST /problems/submit/
{ "extension_id": "existing-user", ... }
```

---

## Testing the API

### Using curl

```bash
# Health check
curl http://localhost:8000/health/

# Register user
curl -X POST http://localhost:8000/api/v1/users/register/ \
  -H "Content-Type: application/json" \
  -d '{"extension_id":"test-123","browser":"chrome"}'

# Check session
curl "http://localhost:8000/api/v1/users/check-session/?extension_id=test-123"

# Get random problem
curl http://localhost:8000/api/v1/problems/random/
```

### Using Python requests

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# Register user
response = requests.post(f"{BASE_URL}/users/register/", json={
    "extension_id": "test-user",
    "browser": "chrome"
})
print(response.json())

# Submit solve
response = requests.post(f"{BASE_URL}/problems/submit/", json={
    "extension_id": "test-user",
    "problem_slug": "two-sum",
    "problem_title": "Two Sum",
    "difficulty": "Easy"
})
print(response.json())
```

---

For more details, see the [C4 Architecture Diagrams](../architecture/C4_DIAGRAMS.md).
