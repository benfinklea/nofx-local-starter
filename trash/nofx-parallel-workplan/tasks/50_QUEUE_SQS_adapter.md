# 50_QUEUE_SQS — Add SQS adapter (no other code changes)

**Depends on:** 00_BASE

## Files to add
- `src/lib/queue/SqsAdapter.ts`

### 1) Adapter
`src/lib/queue/SqsAdapter.ts`
```ts
import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, CreateQueueCommand, GetQueueUrlCommand } from '@aws-sdk/client-sqs';

export class SqsAdapter {
  client = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
  queues = new Map<string, string>();

  async ensureQueue(topic: string){
    if (this.queues.has(topic)) return this.queues.get(topic)!;
    const name = (process.env.SQS_PREFIX || 'nofx-') + topic;
    await this.client.send(new CreateQueueCommand({ QueueName: name }));
    const urlResp = await this.client.send(new GetQueueUrlCommand({ QueueName: name }));
    const url = urlResp.QueueUrl!;
    this.queues.set(topic, url);
    return url;
  }
  async enqueue(topic: string, payload: any){
    const url = await this.ensureQueue(topic);
    await this.client.send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify(payload) }));
  }
  async subscribe(topic: string, handler: (p:any)=>Promise<void>) {
    const url = await this.ensureQueue(topic);
    const poll = async () => {
      const r = await this.client.send(new ReceiveMessageCommand({ QueueUrl: url, MaxNumberOfMessages: 5, WaitTimeSeconds: 10, VisibilityTimeout: 30 }));
      if (r.Messages) for (const m of r.Messages) {
        const body = m.Body ? JSON.parse(m.Body) : {};
        try { await handler(body); } finally {
          await this.client.send(new DeleteMessageCommand({ QueueUrl: url, ReceiptHandle: m.ReceiptHandle! }));
        }
      }
      setImmediate(poll);
    };
    poll();
  }
}
```

### 2) Wire via env only
**Edit `src/lib/queue/index.ts`** to allow SQS (add the extra branch):
```ts
import { RedisQueueAdapter } from "./RedisAdapter";
import { SqsAdapter } from "./SqsAdapter";
const DRIVER = (process.env.QUEUE_DRIVER || 'redis').toLowerCase();
let impl: any;
if (DRIVER === 'redis') impl = new RedisQueueAdapter();
if (DRIVER === 'sqs') impl = new SqsAdapter();
export const STEP_READY_TOPIC = "step.ready";
export const enqueue = (topic:string, payload:any)=>impl.enqueue(topic,payload);
export const subscribe = (topic:string, handler:(p:any)=>Promise<void>)=>impl.subscribe(topic,handler);
```

## Done
Commit: `feat(queue): add SQS adapter and env switch`
