# NOFX Control Plane Integration Guide

This guide walks you through integrating with the NOFX Control Plane API to build custom automation workflows, CI/CD pipelines, and AI-powered development tools.

## Quick Start

### 1. Start the Control Plane

```bash
# Install dependencies
npm install

# Start Supabase (if using local storage)
supabase start

# Start Redis (for queue management)
docker run -d --name redis -p 6379:6379 redis:7

# Start the API server
npm run api

# Start the worker (in another terminal)
npm run worker
```

### 2. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Create your first run
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{
    "plan": {
      "goal": "Hello World",
      "steps": [{
        "name": "hello",
        "tool": "codegen",
        "inputs": {"prompt": "Say hello world"}
      }]
    }
  }'
```

### 3. Explore the API

Visit `http://localhost:3000/api-docs` for interactive API documentation powered by Swagger UI.

## Integration Patterns

### Pattern 1: Simple Automation Script

Create a simple automation that runs quality checks before deployment.

```javascript
// deploy-with-checks.js
const { NOFXClient } = require('./nofx-client');

async function deployWithChecks(projectId) {
  const client = new NOFXClient('http://localhost:3000');

  // Create deployment run with quality gates
  const run = await client.createRun({
    plan: {
      goal: "Deploy with quality checks",
      steps: [
        { name: "typecheck", tool: "gate:typecheck" },
        { name: "tests", tool: "gate:test" },
        { name: "security", tool: "gate:security" },
        { name: "deploy", tool: "deploy:production",
          inputs: { environment: "production" }
        }
      ]
    },
    projectId
  });

  console.log(`Deployment run started: ${run.id}`);

  // Monitor progress
  await client.waitForCompletion(run.id, (event) => {
    console.log(`[${event.event_type}] ${event.payload?.message || ''}`);
  });
}

// Usage
deployWithChecks('my-project')
  .catch(console.error);
```

### Pattern 2: CI/CD Integration

Integrate with GitHub Actions for automated PR checks.

```yaml
# .github/workflows/nofx-check.yml
name: NOFX Quality Check

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run NOFX Quality Gates
        env:
          NOFX_API_URL: ${{ secrets.NOFX_API_URL }}
        run: |
          # Create quality check run
          RUN_ID=$(curl -s -X POST "$NOFX_API_URL/runs" \
            -H "Content-Type: application/json" \
            -d '{
              "standard": {
                "prompt": "Run quality checks for PR #${{ github.event.pull_request.number }}",
                "quality": true
              }
            }' | jq -r '.id')

          echo "Run ID: $RUN_ID"

          # Poll for completion
          while true; do
            STATUS=$(curl -s "$NOFX_API_URL/runs/$RUN_ID" | jq -r '.run.status')
            echo "Status: $STATUS"

            if [ "$STATUS" = "succeeded" ]; then
              echo "Quality checks passed!"
              exit 0
            elif [ "$STATUS" = "failed" ]; then
              echo "Quality checks failed!"
              exit 1
            fi

            sleep 5
          done
```

### Pattern 3: AI-Powered Development Assistant

Build an AI assistant that generates code with built-in quality checks.

```typescript
// ai-assistant.ts
import { NOFXClient } from './nofx-client';
import readline from 'readline';

class AIAssistant {
  private client: NOFXClient;
  private projectId: string;

  constructor(projectId: string) {
    this.client = new NOFXClient();
    this.projectId = projectId;
  }

  async generateCode(prompt: string, options: {
    quality?: boolean;
    openPr?: boolean;
    targetFile?: string;
  } = {}) {
    // Create run with AI codegen
    const run = await this.client.createRun({
      standard: {
        prompt,
        quality: options.quality ?? true,
        openPr: options.openPr ?? false,
        filePath: options.targetFile
      },
      projectId: this.projectId
    });

    console.log(`✨ Generating code... (Run ID: ${run.id})`);

    // Stream progress
    const stream = this.client.streamEvents(run.id, (event) => {
      this.handleEvent(event);
    });

    // Wait for completion
    await this.waitForCompletion(run.id);
    stream.close();

    // Get results
    const details = await this.client.getRun(run.id);
    return this.extractResults(details);
  }

  private handleEvent(event: any) {
    switch (event.event_type) {
      case 'step.started':
        console.log(`⚡ ${event.payload.name} started...`);
        break;
      case 'step.finished':
        if (event.payload.status === 'succeeded') {
          console.log(`✅ ${event.payload.name} completed`);
        } else {
          console.log(`❌ ${event.payload.name} failed`);
        }
        break;
      case 'artifact.created':
        console.log(`📦 Artifact created: ${event.payload.path}`);
        break;
    }
  }

  private async waitForCompletion(runId: string): Promise<void> {
    while (true) {
      const { run } = await this.client.getRun(runId);
      if (['succeeded', 'failed', 'cancelled'].includes(run.status)) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private extractResults(details: any) {
    const artifacts = details.artifacts || [];
    const codeArtifact = artifacts.find((a: any) => a.type === 'code');

    return {
      success: details.run.status === 'succeeded',
      artifacts: artifacts.map((a: any) => ({
        type: a.type,
        path: a.path,
        url: `http://localhost:3000/artifacts/${a.id}`
      })),
      codeGenerated: codeArtifact?.path
    };
  }
}

// Interactive CLI
async function main() {
  const assistant = new AIAssistant('default');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('🤖 AI Development Assistant');
  console.log('Type your request or "exit" to quit\n');

  const prompt = () => {
    rl.question('> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        const result = await assistant.generateCode(input);
        console.log('\n📊 Results:', result);
      } catch (error) {
        console.error('❌ Error:', error);
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
```

### Pattern 4: Webhook Integration

Set up webhooks to trigger actions based on run events.

```typescript
// webhook-server.ts
import express from 'express';
import { WebhookHandler } from './webhook-handler';

const app = express();
app.use(express.json());

const handler = new WebhookHandler();

// Register webhook endpoint
app.post('/webhooks/nofx', async (req, res) => {
  const { event_type, run_id, payload } = req.body;

  try {
    await handler.handleEvent(event_type, run_id, payload);
    res.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// webhook-handler.ts
export class WebhookHandler {
  async handleEvent(eventType: string, runId: string, payload: any) {
    switch (eventType) {
      case 'run.succeeded':
        await this.onRunSuccess(runId, payload);
        break;
      case 'run.failed':
        await this.onRunFailed(runId, payload);
        break;
      case 'gate.pending':
        await this.onGatePending(runId, payload);
        break;
      case 'artifact.created':
        await this.onArtifactCreated(runId, payload);
        break;
    }
  }

  private async onRunSuccess(runId: string, payload: any) {
    // Send Slack notification
    await this.notifySlack({
      text: `✅ Run ${runId} completed successfully`,
      attachments: [{
        title: payload.goal,
        color: 'good',
        fields: [
          { title: 'Duration', value: payload.duration },
          { title: 'Steps', value: payload.steps_count }
        ]
      }]
    });
  }

  private async onRunFailed(runId: string, payload: any) {
    // Create incident ticket
    await this.createIncident({
      title: `Run ${runId} failed`,
      description: payload.error,
      severity: 'high',
      runId
    });
  }

  private async onGatePending(runId: string, payload: any) {
    // Send approval request
    await this.requestApproval({
      gate_id: payload.gate_id,
      description: payload.description,
      approvers: payload.approvers
    });
  }

  private async onArtifactCreated(runId: string, payload: any) {
    // Store in external system
    await this.storeArtifact({
      runId,
      artifactId: payload.artifact_id,
      path: payload.path,
      metadata: payload.metadata
    });
  }

  // Helper methods...
  private async notifySlack(message: any) { /* ... */ }
  private async createIncident(incident: any) { /* ... */ }
  private async requestApproval(request: any) { /* ... */ }
  private async storeArtifact(artifact: any) { /* ... */ }
}
```

## Client Libraries

### JavaScript/TypeScript Client

```typescript
// nofx-client.ts
export class NOFXClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl = 'http://localhost:3000', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    };
  }

  async createRun(options: CreateRunOptions): Promise<Run> {
    const response = await fetch(`${this.baseUrl}/runs`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(options)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async getRun(runId: string): Promise<RunDetails> {
    const response = await fetch(`${this.baseUrl}/runs/${runId}`, {
      headers: this.headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async listRuns(options?: ListRunsOptions): Promise<{ runs: Run[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.projectId) params.append('projectId', options.projectId);

    const response = await fetch(`${this.baseUrl}/runs?${params}`, {
      headers: this.headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  streamEvents(runId: string, onEvent: (event: Event) => void): EventSource {
    const eventSource = new EventSource(`${this.baseUrl}/runs/${runId}/stream`);

    eventSource.addEventListener('init', (e) => {
      const events = JSON.parse(e.data);
      events.forEach(onEvent);
    });

    eventSource.addEventListener('append', (e) => {
      const events = JSON.parse(e.data);
      events.forEach(onEvent);
    });

    return eventSource;
  }

  async approveGate(gateId: string, note?: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/gates/${gateId}/approve`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ note })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
  }

  async waitForCompletion(
    runId: string,
    onProgress?: (event: Event) => void
  ): Promise<RunDetails> {
    return new Promise((resolve, reject) => {
      const stream = this.streamEvents(runId, (event) => {
        if (onProgress) onProgress(event);

        if (event.event_type === 'run.succeeded' ||
            event.event_type === 'run.failed' ||
            event.event_type === 'run.cancelled') {
          stream.close();
          this.getRun(runId).then(resolve).catch(reject);
        }
      });

      stream.onerror = (error) => {
        stream.close();
        reject(error);
      };
    });
  }
}

// Type definitions
interface CreateRunOptions {
  plan?: Plan;
  standard?: StandardOptions;
  projectId?: string;
}

interface Plan {
  goal: string;
  steps: Step[];
}

interface Step {
  name: string;
  tool: string;
  inputs?: Record<string, any>;
  tools_allowed?: string[];
  env_allowed?: string[];
  secrets_scope?: string;
}

interface StandardOptions {
  prompt: string;
  quality?: boolean;
  openPr?: boolean;
  filePath?: string;
}

interface Run {
  id: string;
  status: string;
  projectId: string;
}

interface RunDetails {
  run: Run & {
    goal: string;
    created_at: string;
    updated_at: string;
  };
  steps: StepDetails[];
  artifacts: Artifact[];
}

interface StepDetails {
  id: string;
  name: string;
  tool: string;
  status: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  error?: string;
}

interface Artifact {
  id: string;
  type: string;
  path: string;
  metadata?: Record<string, any>;
}

interface Event {
  event_type: string;
  run_id: string;
  step_id?: string;
  payload?: Record<string, any>;
  created_at: string;
}

interface ListRunsOptions {
  limit?: number;
  projectId?: string;
}

export type { CreateRunOptions, Plan, Step, Run, RunDetails, Event };
```

### Python Client

```python
# nofx_client.py
import json
import time
from typing import Dict, List, Optional, Any, Callable
import requests
import sseclient

class NOFXClient:
    """Client for NOFX Control Plane API"""

    def __init__(self, base_url: str = "http://localhost:3000", api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json'
        })
        if api_key:
            self.session.headers['Authorization'] = f'Bearer {api_key}'

    def create_run(self,
                   plan: Optional[Dict] = None,
                   standard: Optional[Dict] = None,
                   project_id: str = "default") -> Dict:
        """Create a new execution run"""
        payload = {"projectId": project_id}

        if plan:
            payload["plan"] = plan
        elif standard:
            payload["standard"] = standard
        else:
            raise ValueError("Either 'plan' or 'standard' must be provided")

        response = self.session.post(f"{self.base_url}/runs", json=payload)
        response.raise_for_status()
        return response.json()

    def get_run(self, run_id: str) -> Dict:
        """Get run details"""
        response = self.session.get(f"{self.base_url}/runs/{run_id}")
        response.raise_for_status()
        return response.json()

    def list_runs(self, limit: int = 50, project_id: Optional[str] = None) -> List[Dict]:
        """List recent runs"""
        params = {"limit": limit}
        if project_id:
            params["projectId"] = project_id

        response = self.session.get(f"{self.base_url}/runs", params=params)
        response.raise_for_status()
        return response.json()["runs"]

    def stream_events(self, run_id: str, callback: Callable[[Dict], None]):
        """Stream run events in real-time"""
        response = self.session.get(
            f"{self.base_url}/runs/{run_id}/stream",
            stream=True,
            headers={'Accept': 'text/event-stream'}
        )

        client = sseclient.SSEClient(response)
        for event in client.events():
            if event.event in ['init', 'append']:
                events = json.loads(event.data)
                for evt in events:
                    callback(evt)

    def approve_gate(self, gate_id: str, note: Optional[str] = None) -> None:
        """Approve a manual gate"""
        payload = {}
        if note:
            payload["note"] = note

        response = self.session.post(
            f"{self.base_url}/gates/{gate_id}/approve",
            json=payload
        )
        response.raise_for_status()

    def wait_for_completion(self,
                           run_id: str,
                           timeout: int = 300,
                           poll_interval: int = 2) -> Dict:
        """Wait for a run to complete"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            details = self.get_run(run_id)
            status = details["run"]["status"]

            if status in ["succeeded", "failed", "cancelled"]:
                return details

            time.sleep(poll_interval)

        raise TimeoutError(f"Run {run_id} did not complete within {timeout} seconds")

    def create_backup(self, note: Optional[str] = None, scope: str = "data") -> Dict:
        """Create a system backup"""
        payload = {"scope": scope}
        if note:
            payload["note"] = note

        response = self.session.post(f"{self.base_url}/backups", json=payload)
        response.raise_for_status()
        return response.json()


# Example usage
if __name__ == "__main__":
    client = NOFXClient()

    # Create a simple run
    run = client.create_run(
        plan={
            "goal": "Test run",
            "steps": [
                {
                    "name": "test",
                    "tool": "codegen",
                    "inputs": {"prompt": "Write a test"}
                }
            ]
        }
    )

    print(f"Created run: {run['id']}")

    # Wait for completion
    result = client.wait_for_completion(run['id'])
    print(f"Run status: {result['run']['status']}")
```

## Best Practices

### 1. Error Handling

Always implement robust error handling and retries:

```javascript
async function createRunWithRetry(client, options, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.createRun(options);
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed:`, error.message);

      // Exponential backoff
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  throw lastError;
}
```

### 2. Idempotency

Use consistent plans to ensure idempotent operations:

```javascript
// This will create the same step (no duplicate) if called multiple times
const plan = {
  goal: "Daily backup",
  steps: [{
    name: "backup_2024_01_01",  // Use deterministic names
    tool: "backup:daily",
    inputs: {
      date: "2024-01-01",
      retention: 30
    }
  }]
};
```

### 3. Resource Management

Always clean up resources like SSE connections:

```javascript
const stream = client.streamEvents(runId, handleEvent);

try {
  await processRun(runId);
} finally {
  stream.close();  // Always close the stream
}
```

### 4. Monitoring

Implement comprehensive monitoring:

```javascript
class MonitoredClient extends NOFXClient {
  async createRun(options) {
    const startTime = Date.now();

    try {
      const result = await super.createRun(options);

      // Log metrics
      metrics.increment('runs.created');
      metrics.timing('runs.create.duration', Date.now() - startTime);

      return result;
    } catch (error) {
      metrics.increment('runs.create.errors');
      throw error;
    }
  }
}
```

### 5. Security

- Never hardcode credentials
- Use environment variables for sensitive data
- Implement proper authentication
- Validate all inputs
- Use HTTPS in production

```javascript
// Good
const client = new NOFXClient(
  process.env.NOFX_API_URL,
  process.env.NOFX_API_KEY
);

// Bad
const client = new NOFXClient(
  'https://api.example.com',
  'sk-abc123...'  // Never hardcode secrets!
);
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure the API server is running (`npm run api`)
   - Check the port (default: 3000)
   - Verify firewall settings

2. **Authentication Errors**
   - Ensure you're logged in for admin endpoints
   - Check cookie expiration
   - Verify ADMIN_PASSWORD environment variable

3. **Queue Issues**
   - Ensure Redis is running
   - Check worker is processing (`npm run worker`)
   - Monitor queue depth: `GET /dev/queue`

4. **SSE Connection Drops**
   - Implement reconnection logic
   - Check proxy/load balancer timeout settings
   - Consider using webhooks for long-running operations

### Debug Endpoints

```bash
# Check queue status
curl http://localhost:3000/dev/queue

# Check worker health
curl http://localhost:3000/dev/worker/health

# View DLQ items
curl http://localhost:3000/dev/dlq

# Rehydrate failed items
curl -X POST http://localhost:3000/dev/dlq/rehydrate
```

## Migration Guide

### From v0.x to v1.0

1. **API Changes**:
   - `/runs/create` → `POST /runs`
   - `/runs/get/:id` → `GET /runs/:id`
   - Response format standardized

2. **Authentication**:
   - Cookie-based auth for admin endpoints
   - API key support for programmatic access

3. **New Features**:
   - OpenAPI specification
   - Swagger UI documentation
   - Project management
   - Enhanced event streaming

## Support

- **Documentation**: `/docs/control-plane/`
- **API Reference**: `/api-docs` (Swagger UI)
- **OpenAPI Spec**: `/openapi.yaml`
- **GitHub Issues**: [github.com/nofx/issues](https://github.com/nofx/issues)

## Next Steps

1. Explore the [API Reference](./API_REFERENCE.md) for detailed endpoint documentation
2. Try the interactive API explorer at `http://localhost:3000/api-docs`
3. Download the [Postman Collection](./nofx-control-plane.postman.json)
4. Join our community for support and updates