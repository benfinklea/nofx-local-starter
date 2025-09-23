import { StepHandler } from "./types";
import { store } from "../../lib/store";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { log } from "../../lib/logger";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { enqueue, STEP_READY_TOPIC } from "../../lib/queue";
import { buildMinimalEnv, getSecret } from "../../lib/secrets";

type CommitItem = {
  path: string;               // repo-relative file path
  fromArtifact?: string;      // Supabase storage path of artifact (direct)
  fromStep?: string;          // resolve artifact by prior step name
  artifactName?: string;      // filename within that step (e.g., README.md)
  content?: string;           // inline content
  mode?: 'overwrite';
};
type Inputs = {
  branch?: string;
  base?: string;              // base branch (default: main)
  title?: string;
  body?: string;
  draft?: boolean;
  commits: CommitItem[];
};

function sh(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv){
  const p = spawnSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8', env: env || process.env });
  if (p.status !== 0) throw new Error(`cmd failed: ${cmd} ${args.join(' ')}\n${p.stderr}`);
  return p.stdout.trim();
}
function repoRoot(){ return process.cwd(); }
function ensureDir(filePath:string){ fs.mkdirSync(path.dirname(filePath), { recursive: true }); }

// Safely resolve a repo-relative file path, preventing traversal or absolute paths
export function safeRepoPath(repoRoot: string, rel: string): string {
  if (!rel) throw new Error('empty path');
  if (path.isAbsolute(rel)) throw new Error('absolute paths not allowed');
  const base = path.resolve(repoRoot);
  const resolved = path.resolve(base, rel);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) throw new Error('path traversal not allowed');
  return resolved;
}

async function getArtifactBuffer(pth: string): Promise<Buffer> {
  // Support both FS (Simple Mode) and Supabase storage
  if (store.driver === 'fs') {
    const full = path.join(process.cwd(), 'local_data', pth);
    try { return await fs.promises.readFile(full); } catch { throw new Error(`artifact not found: ${pth}`); }
  }
  const { data, error } = await supabase.storage.from(ARTIFACT_BUCKET).download(pth);
  if (error || !data) throw new Error(`artifact not found: ${pth}`);
  const arr = await data.arrayBuffer();
  return Buffer.from(arr);
}

function parseOrigin(url: string){
  // supports git@github.com:owner/repo.git or https://github.com/owner/repo.git
  const m = url.match(/github.com[:/](.+?)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error('unsupported origin url: ' + url);
  return { owner: m[1], repo: m[2] };
}

const handler: StepHandler = {
  match: (tool) => tool === 'git_pr',
  async run({ runId, step }) {
    const stepId = step.id;
    try { await store.updateStep(stepId, { status: 'running', started_at: new Date().toISOString() }); } catch {}
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);

    // Default manual approval for git_pr
    try {
      const g = await store.getLatestGate(runId, stepId);
      if (!g) {
        await store.createOrGetGate(runId, stepId, 'manual:git_pr');
        await recordEvent(runId, 'gate.created', { stepId, tool: 'manual:git_pr' }, stepId);
        await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: 5000 });
        await recordEvent(runId, 'gate.waiting', { stepId, delayMs: 5000 }, stepId);
        return;
      }
      if ((g as any).status === 'pending') {
        await enqueue(STEP_READY_TOPIC, { runId, stepId }, { delay: 5000 });
        await recordEvent(runId, 'gate.waiting', { stepId, delayMs: 5000 }, stepId);
        return;
      }
      if ((g as any).status === 'failed') {
        try { await store.updateStep(stepId, { status: 'failed', ended_at: new Date().toISOString(), outputs: { error: 'git_pr not approved' } }); } catch {}
        await recordEvent(runId, 'step.failed', { stepId, tool: step.tool, manual: true, gateId: (g as any).id }, stepId);
        throw new Error('git_pr not approved');
      }
    } catch {/* non-fatal: continue if store not available */}

    const inputs: Inputs = step.inputs || {};
    if (!Array.isArray(inputs.commits) || inputs.commits.length === 0) throw new Error('git_pr requires commits');
    const base = inputs.base || process.env.GIT_DEFAULT_BASE || 'main';
    const branch = inputs.branch || `feat/run-${runId.slice(0,8)}`;
    const repo = repoRoot();
    const policy = (step.inputs && (step.inputs as any)._policy) || {};
    const envAllowed: string[] | undefined = policy.env_allowed;
    const env = buildMinimalEnv(envAllowed);

    // prepare files
    for (const c of inputs.commits) {
      const outPath = safeRepoPath(repo, c.path);
      ensureDir(outPath);
      if (c.fromArtifact) {
        const buf = await getArtifactBuffer(c.fromArtifact);
        fs.writeFileSync(outPath, buf);
      } else if (c.fromStep && c.artifactName) {
        // resolve artifact by step name and filename
        const steps = await store.listStepsByRun(runId);
        const stepRow = steps.find(s => (s as any).name === c.fromStep);
        const sid = (stepRow as any)?.id;
        if (!sid) throw new Error(`step not found: ${c.fromStep}`);
        const arts = await store.listArtifactsByRun(runId);
        const rec = arts.find(a => (a as any).step_id === sid && String((a as any).path || '').endsWith(`/${c.artifactName}`));
        const pth = (rec as any)?.path as string | undefined;
        if (!pth) throw new Error(`artifact not found: ${c.artifactName} in step ${c.fromStep}`);
        const buf = await getArtifactBuffer(pth);
        fs.writeFileSync(outPath, buf);
      } else if (typeof c.content === 'string') {
        fs.writeFileSync(outPath, c.content, 'utf8');
      } else {
        throw new Error('commit item requires fromArtifact or content');
      }
    }

    // git plumbing
    try { sh('git', ['rev-parse','--is-inside-work-tree'], repo, env); } catch { throw new Error('not a git repo'); }
    sh('git', ['fetch','origin', base], repo, env);
    // Create branch from origin/base
    sh('git', ['checkout','-B', branch, `origin/${base}`], repo, env);
    sh('git', ['add', '--all'], repo, env);
    const commitMsg = inputs.title || `Update by NOFX run ${runId}`;
    // set identity if needed
    try { sh('git', ['config','user.email'], repo, env); } catch { sh('git', ['config','user.email', 'nofx@example.com'], repo, env); }
    try { sh('git', ['config','user.name'], repo, env); } catch { sh('git', ['config','user.name', 'NOFX Bot'], repo, env); }
    sh('git', ['commit','-m', commitMsg], repo, env);
    sh('git', ['push','-u','origin', branch], repo, env);

    // Open PR via GitHub API
    let prUrl: string | undefined;
    try {
      const origin = sh('git', ['config','--get','remote.origin.url'], repo, env);
      const { owner, repo: name } = parseOrigin(origin);
      const token = getSecret('GITHUB_TOKEN', { runId, scope: policy?.secrets_scope || 'github', allowEnv: true, envAllowed })
        || getSecret('GH_TOKEN', { runId, scope: policy?.secrets_scope || 'github', allowEnv: true, envAllowed });
      if (!token) throw new Error('GITHUB_TOKEN not set');
      const rsp = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls`, {
        method: 'POST',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github+json' },
        body: JSON.stringify({
          title: inputs.title || commitMsg,
          head: branch,
          base,
          body: inputs.body || `Automated PR from NOFX run ${runId}`,
          draft: !!inputs.draft
        })
      } as any);
      if ((rsp as any).ok) {
        const data: any = await (rsp as any).json();
        prUrl = data.html_url;
      } else {
        const t = await (rsp as any).text();
        throw new Error(`create PR failed: ${t}`);
      }
    } catch (e:any) {
      log.warn({ err: e?.message }, 'PR creation failed; commit pushed');
    }

    const outputs = { branch, base, prUrl, files: inputs.commits.map(c=>c.path) };
    await store.updateStep(stepId, { status: 'succeeded', ended_at: new Date().toISOString(), outputs });
    await recordEvent(runId, 'step.finished', outputs, stepId);
  }
};

export default handler;
