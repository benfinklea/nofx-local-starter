# NOFX Control Plane API Reference

## Overview

The NOFX Control Plane provides a REST API for orchestrating execution runs, managing manual approvals, and monitoring system health. This document provides a complete reference for all available endpoints.

## Base URL

- **Local Development**: `http://localhost:3000`
- **Production**: Configure via environment variables

## Authentication

Most administrative endpoints require authentication via cookie. Authentication flow:

1. **Login**: POST to `/login` with admin password
2. **Cookie**: Receive `nofx_admin` cookie (HttpOnly, SameSite=Lax)
3. **Use**: Include cookie in subsequent requests
4. **Logout**: POST to `/logout` to clear session

```bash
# Login
curl -c cookies.txt -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin"}'

# Use cookie for authenticated requests
curl -b cookies.txt http://localhost:3000/projects
```

## Response Formats

All endpoints return JSON unless otherwise specified. Standard response structure:

### Success Response
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": {
    "field": "validation error"
  }
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 404 | Not Found |
| 500 | Internal Server Error |

## Core Endpoints

### Runs

#### Create Run

Creates a new execution run from a plan or natural language prompt.

**Endpoint**: `POST /runs`

**Headers**:
- `Content-Type: application/json`
- `x-project-id: {projectId}` (optional, defaults to "default")

**Request Body (Plan Mode)**:
```json
{
  "plan": {
    "goal": "Deploy application",
    "steps": [
      {
        "name": "typecheck",
        "tool": "gate:typecheck",
        "inputs": {}
      },
      {
        "name": "deploy",
        "tool": "codegen",
        "inputs": {
          "prompt": "Deploy to production"
        },
        "tools_allowed": ["terraform"],
        "secrets_scope": "production"
      }
    ]
  },
  "projectId": "my-project"
}
```

**Request Body (Standard Mode)**:
```json
{
  "standard": {
    "prompt": "Write unit tests for auth module",
    "quality": true,
    "openPr": false,
    "filePath": "src/auth.test.ts"
  }
}
```

**Response**: `201 Created`
```json
{
  "id": "run_abc123",
  "status": "queued",
  "projectId": "my-project"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "goal": "hello world",
      "steps": [
        {
          "name": "hello",
          "tool": "codegen",
          "inputs": {"prompt": "Say hello"}
        }
      ]
    }
  }'
```

#### Preview Run

Preview the plan that would be generated from a prompt without creating a run.

**Endpoint**: `POST /runs/preview`

**Request Body**:
```json
{
  "standard": {
    "prompt": "Add authentication to the API",
    "quality": true
  }
}
```

**Response**: `200 OK`
```json
{
  "steps": [...],
  "plan": {
    "goal": "Add authentication to the API",
    "steps": [...]
  }
}
```

#### Get Run Details

Retrieve complete information about a run including steps and artifacts.

**Endpoint**: `GET /runs/{id}`

**Response**: `200 OK`
```json
{
  "run": {
    "id": "run_abc123",
    "status": "succeeded",
    "goal": "Deploy application",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:05:00Z"
  },
  "steps": [
    {
      "id": "step_123",
      "name": "typecheck",
      "tool": "gate:typecheck",
      "status": "succeeded",
      "outputs": {...}
    }
  ],
  "artifacts": [
    {
      "id": "artifact_456",
      "type": "file",
      "path": "artifacts/run_abc123/output.txt"
    }
  ]
}
```

#### List Runs

Get a list of recent runs with optional filtering.

**Endpoint**: `GET /runs`

**Query Parameters**:
- `limit` (integer, 1-200, default: 50): Maximum runs to return
- `projectId` (string): Filter by project

**Response**: `200 OK`
```json
{
  "runs": [
    {
      "id": "run_abc123",
      "status": "succeeded",
      "goal": "Deploy application",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Run Timeline

Retrieve the complete event timeline for a run.

**Endpoint**: `GET /runs/{id}/timeline`

**Response**: `200 OK`
```json
[
  {
    "id": "event_1",
    "run_id": "run_abc123",
    "event_type": "run.created",
    "payload": {...},
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "event_2",
    "event_type": "step.started",
    "step_id": "step_123",
    "created_at": "2024-01-01T00:00:01Z"
  }
]
```

#### Stream Run Events (SSE)

Real-time event stream using Server-Sent Events.

**Endpoint**: `GET /runs/{id}/stream`

**Headers**:
- `Accept: text/event-stream`

**Response**: `200 OK` (SSE Stream)
```
event: init
data: [{"event_type":"run.created",...}]

event: append
data: [{"event_type":"step.started",...}]
```

**Example (JavaScript)**:
```javascript
const eventSource = new EventSource(`/runs/${runId}/stream`);

eventSource.addEventListener('init', (e) => {
  const events = JSON.parse(e.data);
  console.log('Initial events:', events);
});

eventSource.addEventListener('append', (e) => {
  const newEvents = JSON.parse(e.data);
  console.log('New events:', newEvents);
});
```

### Gates (Manual Approvals)

#### List Gates for Run

Get all manual approval gates for a specific run.

**Endpoint**: `GET /runs/{id}/gates`

**Authentication**: Required

**Response**: `200 OK`
```json
[
  {
    "id": "gate_123",
    "name": "deploy_approval",
    "description": "Approve production deployment",
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Create Gate

Create a new manual approval gate.

**Endpoint**: `POST /gates`

**Authentication**: Required

**Request Body**:
```json
{
  "runId": "run_abc123",
  "stepId": "step_456",
  "name": "deploy_approval",
  "description": "Approve deployment to production"
}
```

#### Approve Gate

Approve a pending gate to continue execution.

**Endpoint**: `POST /gates/{id}/approve`

**Authentication**: Required

**Request Body** (optional):
```json
{
  "note": "Approved after review"
}
```

**Response**: `200 OK`
```json
{
  "ok": true,
  "message": "Gate approved"
}
```

#### Waive Gate

Skip a gate without approval.

**Endpoint**: `POST /gates/{id}/waive`

**Authentication**: Required

**Request Body**:
```json
{
  "reason": "Testing in development environment"
}
```

### Projects

#### List Projects

**Endpoint**: `GET /projects`

**Authentication**: Required

#### Create Project

**Endpoint**: `POST /projects`

**Authentication**: Required

**Request Body**:
```json
{
  "name": "my-project",
  "description": "My application",
  "local_path": "/path/to/project",
  "workspace_mode": "local_path"
}
```

#### Update Project

**Endpoint**: `PATCH /projects/{id}`

**Authentication**: Required

### System Operations

#### Health Check

**Endpoint**: `GET /health`

**Response**: `200 OK`
```json
{
  "ok": true,
  "database": {
    "status": "ok"
  }
}
```

#### Metrics (Prometheus Format)

**Endpoint**: `GET /metrics`

**Response**: `200 OK`
```
# HELP nofx_runs_total Total number of runs
# TYPE nofx_runs_total counter
nofx_runs_total 42

# HELP nofx_steps_duration_seconds Step execution duration
# TYPE nofx_steps_duration_seconds histogram
nofx_steps_duration_seconds_bucket{le="1"} 10
```

#### Create Backup

**Endpoint**: `POST /backups`

**Authentication**: Required

**Request Body**:
```json
{
  "note": "Before major update",
  "scope": "data"
}
```

#### Restore Backup

**Endpoint**: `POST /backups/{id}/restore`

**Authentication**: Required

## Webhook Events

The control plane emits events that can be consumed via webhooks or the SSE stream:

| Event Type | Description | Payload |
|------------|-------------|---------|
| `run.created` | New run created | Plan details |
| `run.started` | Run execution began | Run ID |
| `run.succeeded` | Run completed successfully | Results |
| `run.failed` | Run failed | Error details |
| `step.enqueued` | Step added to queue | Step details |
| `step.started` | Step execution began | Step ID |
| `step.finished` | Step completed | Outputs |
| `gate.created` | Manual gate created | Gate details |
| `gate.approved` | Gate approved | Approver info |
| `artifact.created` | Artifact uploaded | Path, metadata |

## Rate Limits

Default rate limits (configurable via environment):

- **Run Creation**: 100 per minute per IP
- **API Reads**: 1000 per minute per IP
- **SSE Streams**: 10 concurrent per IP

## SDK Examples

### JavaScript/TypeScript

```typescript
class NOFXClient {
  constructor(private baseUrl: string = 'http://localhost:3000') {}

  async createRun(plan: Plan): Promise<Run> {
    const response = await fetch(`${this.baseUrl}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });
    return response.json();
  }

  async getRun(id: string): Promise<RunDetails> {
    const response = await fetch(`${this.baseUrl}/runs/${id}`);
    return response.json();
  }

  streamEvents(runId: string, onEvent: (event: Event) => void) {
    const eventSource = new EventSource(`${this.baseUrl}/runs/${runId}/stream`);

    eventSource.addEventListener('append', (e) => {
      const events = JSON.parse(e.data);
      events.forEach(onEvent);
    });

    return eventSource;
  }
}

// Usage
const client = new NOFXClient();
const run = await client.createRun({
  goal: "Deploy app",
  steps: [...]
});

client.streamEvents(run.id, (event) => {
  console.log('Event:', event.event_type);
});
```

### Python

```python
import requests
import sseclient

class NOFXClient:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.session = requests.Session()

    def create_run(self, plan):
        response = self.session.post(
            f'{self.base_url}/runs',
            json={'plan': plan}
        )
        response.raise_for_status()
        return response.json()

    def get_run(self, run_id):
        response = self.session.get(f'{self.base_url}/runs/{run_id}')
        response.raise_for_status()
        return response.json()

    def stream_events(self, run_id):
        response = self.session.get(
            f'{self.base_url}/runs/{run_id}/stream',
            stream=True
        )
        client = sseclient.SSEClient(response)

        for event in client.events():
            if event.event == 'append':
                yield json.loads(event.data)

# Usage
client = NOFXClient()
run = client.create_run({
    'goal': 'Deploy app',
    'steps': [...]
})

for event in client.stream_events(run['id']):
    print(f"Event: {event['event_type']}")
```

## Error Handling

The API returns structured error responses with appropriate HTTP status codes:

```json
{
  "error": "Validation failed",
  "details": {
    "plan.steps": "Must contain at least one step",
    "plan.goal": "Required field"
  }
}
```

Common error scenarios:

1. **400 Bad Request**: Invalid input data, missing required fields
2. **401 Unauthorized**: Missing or invalid authentication
3. **404 Not Found**: Resource doesn't exist
4. **409 Conflict**: Idempotency key conflict
5. **429 Too Many Requests**: Rate limit exceeded
6. **500 Internal Server Error**: Server-side error

## Idempotency

The API supports idempotency for safe retries. Each step has an automatic idempotency key:

```
{runId}:{stepName}:{hash(inputs)}
```

Repeated requests with the same plan and inputs will not create duplicate steps.

## Versioning

The API uses URL versioning. Current version: v1 (implicit, no version in URL).

Future versions will use: `/v2/runs`, `/v3/runs`, etc.

## Support

- GitHub Issues: [github.com/nofx/control-plane/issues](https://github.com/nofx/control-plane/issues)
- Documentation: [docs.nofx.io](https://docs.nofx.io)
- OpenAPI Spec: `/docs/control-plane/openapi.yaml`