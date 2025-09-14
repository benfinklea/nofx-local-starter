import { updateSettings } from '../src/lib/settings';

async function main(){
  const docs = process.env.NOFX_DOCS_ORDER?.split(',').map(s=>s.trim()).filter(Boolean)
    || ['gemini-2.5-pro'];
  const reasoning = process.env.NOFX_REASONING_ORDER?.split(',').map(s=>s.trim()).filter(Boolean)
    || ['claude-4-sonnet'];
  const codegen = process.env.NOFX_CODEGEN_ORDER?.split(',').map(s=>s.trim()).filter(Boolean)
    || ['gpt-5'];
  const settings = await updateSettings({
    llm: { modelOrder: { docs, reasoning, codegen } }
  } as any);
  console.log('Updated model order:', settings.llm.modelOrder);
}

main().catch((e)=>{ console.error(e); process.exit(1); });

