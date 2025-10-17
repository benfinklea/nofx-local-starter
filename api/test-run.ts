import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from '../src/lib/store';
import { enqueue, STEP_READY_TOPIC } from '../src/lib/queue';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const plan = {
      goal: "write a haiku about debugging code",
      steps: [{
        name: "generate_haiku",
        tool: "codegen",
        inputs: {
          prompt: "Write a haiku (5-7-5 syllables) about the process of debugging code. Make it thoughtful and relatable."
        }
      }]
    };

    const run = await store.createRun(plan, 'default');
    const step = await store.createStep(run.id, 'generate_haiku', 'codegen', {
      prompt: "Write a haiku about debugging code"
    });

    await enqueue(STEP_READY_TOPIC, {
      runId: run.id,
      stepId: step.id
    });

    return res.json({ 
      id: run.id, 
      stepId: step.id,
      status: 'queued',
      message: 'Run created successfully! Check Railway logs for worker activity.'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Unknown error' });
  }
}
