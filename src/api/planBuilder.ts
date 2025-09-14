import { getSettings } from "../lib/settings";

export function guessTopicFromPrompt(p:string){
  if (!p) return 'NOFX';
  const m = p.split(/[\.\n]/)[0] || p;
  const words = m.trim().split(/\s+/).slice(0, 8).join(' ');
  return words || 'NOFX';
}

export function guessMarkdownPath(p: string): string | undefined {
  if (!p) return undefined;
  const m = p.match(/(?:^|\s)([\w\-/.]+\.md)\b/i);
  if (m) return m[1];
  if (/\bin docs\b/i.test(p)) return 'docs/README.md';
  return undefined;
}

export async function buildPlanFromPrompt(prompt: string, opts: { quality: boolean; openPr: boolean; filePath?: string; summarizeQuery?: string; summarizeTarget?: string }){
  const { gates } = await getSettings();
  const steps: any[] = [];
  if (opts.quality) {
    if (gates.typecheck) steps.push({ name: 'typecheck', tool: 'gate:typecheck' });
    if (gates.lint) steps.push({ name: 'lint', tool: 'gate:lint' });
    if (gates.unit) steps.push({ name: 'unit', tool: 'gate:unit' });
  }
  const topic = guessTopicFromPrompt(prompt);
  const hinted = guessMarkdownPath(prompt);
  const targetPath = (opts.filePath && String(opts.filePath).trim()) || hinted || 'README.md';
  const filename = targetPath.split('/').pop() || 'README.md';
  steps.push({ name: 'write readme', tool: 'codegen', inputs: { topic, bullets: ['Control plane','Verification','Workers'], filename } });
  if (opts.summarizeQuery && (opts.summarizeTarget || /summarize/i.test(prompt))) {
    const sumPath = String(opts.summarizeTarget || 'docs/summary.md');
    const sumName = sumPath.split('/').pop() || 'summary.md';
    steps.push({ name: 'summarize', tool: 'codegen', inputs: { topic: `Summarize: ${opts.summarizeQuery}`, bullets: ['Key points','Action items','References'], filename: sumName } });
    if (opts.openPr) {
      steps.push({ name: 'open pr (summary)', tool: 'git_pr', inputs: { branch: `feat/summary-${Date.now().toString().slice(-4)}`, base: 'main', title: `docs: summary of ${opts.summarizeQuery}`, commits: [ { path: sumPath, fromStep: 'summarize', artifactName: sumName } ] } });
    }
  }
  const prAskedInPrompt = /\bopen a pr\b/i.test(prompt);
  const prBySetting = opts.openPr === true;
  const shouldPR = prBySetting || prAskedInPrompt;
  if (shouldPR) {
    const branchBase = topic.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24) || 'update-docs';
    const reason = prBySetting ? 'Setting' : 'Prompt';
    steps.push({ name: 'open pr', tool: 'git_pr', inputs: { branch: `feat/${branchBase}`, base: 'main', title: `docs: ${topic}`, commits: [ { path: targetPath, fromStep: 'write readme', artifactName: filename } ], reason } });
  }
  if (/manual approval|human approve|require approval/i.test(prompt)) {
    steps.unshift({ name: 'approval', tool: 'manual:deploy' });
  }
  return { goal: prompt || 'ad-hoc run', steps };
}

