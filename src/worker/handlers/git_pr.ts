import { StepHandler } from "./types";
import { query } from "../../lib/db";
import { recordEvent } from "../../lib/events";
import { supabase, ARTIFACT_BUCKET } from "../../lib/supabase";
import { log } from "../../lib/logger";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

function sh(cmd: string, args: string[], cwd: string){
  const p = spawnSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  if (p.status !== 0) throw new Error(`cmd failed: ${cmd} ${args.join(' ')}\n${p.stderr}`);
  return p.stdout.trim();
}
function repoRoot(){ return process.cwd(); }
function ensureDir(filePath:string){ fs.mkdirSync(path.dirname(filePath), { recursive: true }); }

async function getArtifactBuffer(pth: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(ARTIFACT_BUCKET).download(pth);
  if (error || !data) throw new Error(`artifact not found: ${pth}`);
  const arr = await data.arrayBuffer();
  return Buffer.from(arr);
}

function parseOrigin(url: string){
  // supports git@github.com:owner/repo.git or https://github.com/owner/repo.git
  let m = url.match(/github.com[:/](.+?)\/(.+?)(?:\.git)?$/);
  if (!m) throw new Error('unsupported origin url: ' + url);
  return { owner: m[1], repo: m[2] };
}

const handler: StepHandler = {
  match: (tool) => tool === 'git_pr',
  async run({ runId, step }) {
    const stepId = step.id;
    await query(`update nofx.step set status='running', started_at=now() where id=$1`, [stepId])
      .catch(async ()=>{ await query(`update nofx.step set status='running' where id=$1`, [stepId]); });
    await recordEvent(runId, 'step.started', { name: step.name, tool: step.tool }, stepId);

    const inputs: Inputs = step.inputs || {};
    if (!Array.isArray(inputs.commits) || inputs.commits.length === 0) throw new Error('git_pr requires commits');
    const base = inputs.base || process.env.GIT_DEFAULT_BASE || 'main';
    const branch = inputs.branch || `feat/run-${runId.slice(0,8)}`;
    const repo = repoRoot();

    // prepare files
    for (const c of inputs.commits) {
      const outPath = path.join(repo, c.path);
      ensureDir(outPath);
      if (c.fromArtifact) {
        const buf = await getArtifactBuffer(c.fromArtifact);
        fs.writeFileSync(outPath, buf);
      } else if (c.fromStep && c.artifactName) {
        // resolve artifact by step name and filename
        const stepRow = await query<any>(`select id from nofx.step where run_id=$1 and name=$2 limit 1`, [runId, c.fromStep]);
        const sid = stepRow.rows[0]?.id;
        if (!sid) throw new Error(`step not found: ${c.fromStep}`);
        const art = await query<any>(`select coalesce(uri,path) as uri from nofx.artifact where step_id=$1 and (uri like $2 or path like $2) limit 1`, [sid, `%/${c.artifactName}`]);
        const pth = art.rows[0]?.uri;
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
    try { sh('git', ['rev-parse','--is-inside-work-tree'], repo); } catch { throw new Error('not a git repo'); }
    sh('git', ['fetch','origin', base], repo);
    // Create branch from origin/base
    sh('git', ['checkout','-B', branch, `origin/${base}`], repo);
    sh('git', ['add', '--all'], repo);
    const commitMsg = inputs.title || `Update by NOFX run ${runId}`;
    // set identity if needed
    try { sh('git', ['config','user.email'], repo); } catch { sh('git', ['config','user.email', 'nofx@example.com'], repo); }
    try { sh('git', ['config','user.name'], repo); } catch { sh('git', ['config','user.name', 'NOFX Bot'], repo); }
    sh('git', ['commit','-m', commitMsg], repo);
    sh('git', ['push','-u','origin', branch], repo);

    // Open PR via GitHub API
    let prUrl: string | undefined;
    try {
      const origin = sh('git', ['config','--get','remote.origin.url'], repo);
      const { owner, repo: name } = parseOrigin(origin);
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
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
    await query(`update nofx.step set status='succeeded', outputs=$2, ended_at=now() where id=$1`, [
      stepId, JSON.stringify(outputs)
    ]).catch(async ()=>{
      await query(`update nofx.step set status='succeeded', outputs=$2, completed_at=now() where id=$1`, [
        stepId, JSON.stringify(outputs)
      ]);
    });
    await recordEvent(runId, 'step.finished', outputs, stepId);
  }
};

export default handler;
