import { query, withTransaction } from './db';
import { timeIt, log } from './observability';
import { metrics } from './metrics';
import type {
  AgentSummary,
  AgentDetail,
  PublishAgentRequest,
  ListAgentsQuery,
  ListAgentsResponse,
  ValidateAgentResponse,
  AgentVersionSummary
} from '../../packages/shared/src/agents';
import type {
  TemplateSummary,
  TemplateDetail,
  PublishTemplateRequest,
  ListTemplatesQuery,
  ListTemplatesResponse,
  ValidateTemplateResponse,
  TemplateVersionSummary
} from '../../packages/shared/src/templates';

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  try {
    await query(`select 1 from nofx.agent_registry limit 1`);
    await query(`select 1 from nofx.template_registry limit 1`);
    schemaReady = true;
  } catch (err) {
    log.error({ err }, 'registry.ensureSchema.missing');
    throw new Error('Agent/template registry tables are missing. Run Supabase migrations before using the registry.');
  }
}

type AgentRow = {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  status: string;
  current_version: string;
  tags: string[];
  capabilities: unknown[];
  metadata: Record<string, unknown>;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

type AgentVersionRow = {
  id: string;
  agent_id: string;
  version: string;
  status: string;
  manifest: Record<string, unknown>;
  checksum: string | null;
  source_commit: string | null;
  published_at: string;
};

function mapAgentRow(row: AgentRow): AgentSummary {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as AgentSummary['status'],
    currentVersion: row.current_version,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    updatedAt: row.updated_at
  };
}

function mapAgentDetail(row: AgentRow, versions: AgentVersionSummary[]): AgentDetail {
  return {
    ...mapAgentRow(row),
    versions,
    metadata: row.metadata ?? undefined,
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at
  };
}

function mapAgentVersionRow(row: AgentVersionRow): AgentVersionSummary {
  return {
    id: row.id,
    version: row.version,
    status: row.status as AgentVersionSummary['status'],
    publishedAt: row.published_at,
    checksum: row.checksum ?? undefined,
    sourceCommit: row.source_commit ?? undefined
  };
}

type TemplateRow = {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  status: string;
  current_version: string;
  tags: string[];
  category: string | null;
  metadata: Record<string, unknown>;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

type TemplateVersionRow = {
  id: string;
  template_id: string;
  version: string;
  status: string;
  content: Record<string, unknown>;
  checksum: string | null;
  change_summary: string | null;
  published_at: string;
};

function mapTemplateRow(row: TemplateRow): TemplateSummary {
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as TemplateSummary['status'],
    currentVersion: row.current_version,
    tags: Array.isArray(row.tags) ? row.tags : [],
    category: row.category ?? undefined,
    popularityScore: undefined,
    updatedAt: row.updated_at
  };
}

function mapTemplateDetail(row: TemplateRow, versions: TemplateVersionSummary[]): TemplateDetail {
  return {
    ...mapTemplateRow(row),
    versions,
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
    analytics: {
      usageCount30d: 0,
      successRate30d: 0
    }
  };
}

function mapTemplateVersionRow(row: TemplateVersionRow): TemplateVersionSummary {
  return {
    id: row.id,
    version: row.version,
    status: row.status as TemplateVersionSummary['status'],
    publishedAt: row.published_at,
    checksum: row.checksum ?? undefined,
    changeSummary: row.change_summary ?? undefined
  };
}

export async function listAgents(queryParams: ListAgentsQuery = {}): Promise<ListAgentsResponse> {
  await ensureSchema();
  const conditions: string[] = [];
  const params: any[] = [];

  if (queryParams.status) {
    params.push(queryParams.status);
    conditions.push(`status = $${params.length}`);
  }
  if (queryParams.tag) {
    params.push(queryParams.tag);
    conditions.push(`$${params.length} = any(tags)`);
  }
  if (queryParams.search) {
    params.push(`%${queryParams.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(lower(name) like $${idx} or lower(coalesce(description,'')) like $${idx})`);
  }

  const limit = Math.min(Math.max(queryParams.limit ?? 25, 1), 100);
  let sql = `select * from nofx.agent_registry`;
  if (conditions.length) {
    sql += ` where ${conditions.join(' and ')}`;
  }
  sql += ` order by updated_at desc limit ${limit}`;

  const { result, latencyMs } = await timeIt('registry.listAgents', async () =>
    query<AgentRow>(sql, params)
  );
  try { metrics.registryOperationDuration.observe({ entity: 'agent', action: 'list' }, latencyMs); } catch {}
  return {
    agents: result.rows.map(mapAgentRow)
  };
}

export async function getAgent(agentId: string): Promise<AgentDetail | null> {
  await ensureSchema();
  const { result: agentRes, latencyMs } = await timeIt('registry.getAgent', async () =>
    query<AgentRow>(`select * from nofx.agent_registry where agent_id = $1 limit 1`, [agentId])
  );
  try { metrics.registryOperationDuration.observe({ entity: 'agent', action: 'get' }, latencyMs); } catch {}
  const agent = agentRes.rows[0];
  if (!agent) return null;
  const versionsRes = await query<AgentVersionRow>(
    `select * from nofx.agent_versions where agent_id = $1 order by published_at desc`,
    [agent.id]
  );
  const versions = versionsRes.rows.map(mapAgentVersionRow);
  return mapAgentDetail(agent, versions);
}

export async function publishAgent(payload: PublishAgentRequest): Promise<AgentDetail> {
  await ensureSchema();
  const { result, latencyMs } = await timeIt('registry.publishAgent', async () => withTransaction(async () => {
    const existingRes = await query<AgentRow>(`select * from nofx.agent_registry where agent_id = $1 limit 1`, [payload.agentId]);
    const tags = payload.tags ?? [];
    const capabilities = payload.capabilities ?? [];
    const metadata = payload.metadata ?? {};
    let agentRow: AgentRow;

    if (existingRes.rows[0]) {
      const updatedRes = await query<AgentRow>(
        `update nofx.agent_registry
         set name = $2,
             description = $3,
             status = 'active',
             current_version = $4,
             tags = $5,
             capabilities = $6,
             metadata = $7,
             updated_at = now()
         where agent_id = $1
         returning *`,
        [payload.agentId, payload.name, payload.description ?? null, payload.version, tags, capabilities, metadata]
      );
      agentRow = updatedRes.rows[0];
    } else {
      const inserted = await query<AgentRow>(
        `insert into nofx.agent_registry
           (agent_id, name, description, status, current_version, tags, capabilities, metadata)
         values ($1,$2,$3,'active',$4,$5,$6,$7)
         returning *`,
        [payload.agentId, payload.name, payload.description ?? null, payload.version, tags, capabilities, metadata]
      );
      agentRow = inserted.rows[0];
    }

    await query(
      `update nofx.agent_versions set status = 'archived' where agent_id = $1 and version <> $2`,
      [agentRow.id, payload.version]
    );

    await query<AgentVersionRow>(
      `insert into nofx.agent_versions (agent_id, version, status, manifest, checksum, source_commit)
       values ($1,$2,'active',$3,$4,$5)
       on conflict (agent_id, version)
       do update set status='active', manifest=excluded.manifest, checksum=excluded.checksum, source_commit=excluded.source_commit, published_at=now()`,
      [agentRow.id, payload.version, payload.manifest ?? {}, null, payload.sourceCommit ?? null]
    );

    const detail = await getAgent(payload.agentId);
    if (!detail) throw new Error('failed to load agent after publish');
    return detail;
  }));
  try { metrics.registryOperationDuration.observe({ entity: 'agent', action: 'publish' }, latencyMs); } catch {}
  log.info({ event: 'registry.agent.published', agentId: payload.agentId, version: payload.version, latencyMs }, 'Agent published');
  return result as AgentDetail;
}

export async function validateAgent(payload: PublishAgentRequest): Promise<ValidateAgentResponse> {
  const errors: { field: string; message: string }[] = [];
  if (!payload.agentId) errors.push({ field: 'agentId', message: 'agentId is required' });
  if (!payload.name) errors.push({ field: 'name', message: 'name is required' });
  if (!payload.version) errors.push({ field: 'version', message: 'version is required' });
  if (!payload.manifest || typeof payload.manifest !== 'object') {
    errors.push({ field: 'manifest', message: 'manifest must be an object' });
  }
  return { valid: errors.length === 0, errors };
}

export async function rollbackAgent(agentId: string, targetVersion: string): Promise<AgentDetail> {
  await ensureSchema();
  const { result, latencyMs } = await timeIt('registry.rollbackAgent', async () => withTransaction(async () => {
    const agentRes = await query<AgentRow>(`select * from nofx.agent_registry where agent_id = $1 limit 1`, [agentId]);
    const agentRow = agentRes.rows[0];
    if (!agentRow) throw new Error('agent not found');

    const versionRes = await query<AgentVersionRow>(
      `select * from nofx.agent_versions where agent_id = $1 and version = $2 limit 1`,
      [agentRow.id, targetVersion]
    );
    if (!versionRes.rows[0]) throw new Error('target version not found');

    await query(`update nofx.agent_versions set status = case when version = $2 then 'active' else 'archived' end where agent_id = $1`, [agentRow.id, targetVersion]);
    await query(`update nofx.agent_registry set current_version = $2, status = 'active', updated_at = now() where id = $1`, [agentRow.id, targetVersion]);

    const detail = await getAgent(agentId);
    if (!detail) throw new Error('failed to load agent after rollback');
    return detail;
  }));
  try { metrics.registryOperationDuration.observe({ entity: 'agent', action: 'rollback' }, latencyMs); } catch {}
  log.info({ event: 'registry.agent.rollback', agentId, targetVersion, latencyMs }, 'Agent rolled back');
  return result as AgentDetail;
}

export async function listTemplates(queryParams: ListTemplatesQuery = {}): Promise<ListTemplatesResponse> {
  await ensureSchema();
  const conditions: string[] = [];
  const params: any[] = [];

  if (queryParams.status) {
    params.push(queryParams.status);
    conditions.push(`status = $${params.length}`);
  }
  if (queryParams.tag) {
    params.push(queryParams.tag);
    conditions.push(`$${params.length} = any(tags)`);
  }
  if (queryParams.category) {
    params.push(queryParams.category);
    conditions.push(`category = $${params.length}`);
  }
  if (queryParams.search) {
    params.push(`%${queryParams.search.toLowerCase()}%`);
    const idx = params.length;
    conditions.push(`(lower(name) like $${idx} or lower(coalesce(description,'')) like $${idx})`);
  }

  const limit = Math.min(Math.max(queryParams.limit ?? 25, 1), 100);
  let sql = `select * from nofx.template_registry`;
  if (conditions.length) {
    sql += ` where ${conditions.join(' and ')}`;
  }
  sql += ` order by updated_at desc limit ${limit}`;

  const { result, latencyMs } = await timeIt('registry.listTemplates', async () =>
    query<TemplateRow>(sql, params)
  );
  try { metrics.registryOperationDuration.observe({ entity: 'template', action: 'list' }, latencyMs); } catch {}
  return {
    templates: result.rows.map(mapTemplateRow)
  };
}

export async function getTemplate(templateId: string): Promise<TemplateDetail | null> {
  await ensureSchema();
  const { result: templateRes, latencyMs } = await timeIt('registry.getTemplate', async () =>
    query<TemplateRow>(`select * from nofx.template_registry where template_id = $1 limit 1`, [templateId])
  );
  try { metrics.registryOperationDuration.observe({ entity: 'template', action: 'get' }, latencyMs); } catch {}
  const templateRow = templateRes.rows[0];
  if (!templateRow) return null;
  const versionsRes = await query<TemplateVersionRow>(
    `select * from nofx.template_versions where template_id = $1 order by published_at desc`,
    [templateRow.id]
  );
  const versions = versionsRes.rows.map(mapTemplateVersionRow);
  return mapTemplateDetail(templateRow, versions);
}

export async function publishTemplate(payload: PublishTemplateRequest): Promise<TemplateDetail> {
  await ensureSchema();
  const { result, latencyMs } = await timeIt('registry.publishTemplate', async () => withTransaction(async () => {
    const existingRes = await query<TemplateRow>(`select * from nofx.template_registry where template_id = $1 limit 1`, [payload.templateId]);
    const tags = payload.tags ?? [];
    const metadata = payload.metadata ?? {};
    let templateRow: TemplateRow;

    if (existingRes.rows[0]) {
      const updated = await query<TemplateRow>(
        `update nofx.template_registry
         set name = $2,
             description = $3,
             status = 'published',
             current_version = $4,
             tags = $5,
             category = $6,
             metadata = $7,
             updated_at = now()
         where template_id = $1
         returning *`,
        [payload.templateId, payload.name, payload.description ?? null, payload.version, tags, payload.category ?? null, metadata]
      );
      templateRow = updated.rows[0];
    } else {
      const inserted = await query<TemplateRow>(
        `insert into nofx.template_registry
           (template_id, name, description, status, current_version, tags, category, metadata)
         values ($1,$2,$3,'published',$4,$5,$6,$7)
         returning *`,
        [payload.templateId, payload.name, payload.description ?? null, payload.version, tags, payload.category ?? null, metadata]
      );
      templateRow = inserted.rows[0];
    }

    await query(
      `update nofx.template_versions set status = 'archived' where template_id = $1 and version <> $2`,
      [templateRow.id, payload.version]
    );

    await query<TemplateVersionRow>(
      `insert into nofx.template_versions (template_id, version, status, content, checksum, change_summary)
       values ($1,$2,'published',$3,null,null)
       on conflict (template_id, version)
       do update set status='published', content=excluded.content, published_at=now()`,
      [templateRow.id, payload.version, payload.content ?? {}]
    );

    const detail = await getTemplate(payload.templateId);
    if (!detail) throw new Error('failed to load template after publish');
    return detail;
  }));
  try { metrics.registryOperationDuration.observe({ entity: 'template', action: 'publish' }, latencyMs); } catch {}
  log.info({ event: 'registry.template.published', templateId: payload.templateId, version: payload.version, latencyMs }, 'Template published');
  return result as TemplateDetail;
}

export async function validateTemplate(payload: PublishTemplateRequest): Promise<ValidateTemplateResponse> {
  const errors: { field: string; message: string }[] = [];
  if (!payload.templateId) errors.push({ field: 'templateId', message: 'templateId is required' });
  if (!payload.name) errors.push({ field: 'name', message: 'name is required' });
  if (!payload.version) errors.push({ field: 'version', message: 'version is required' });
  if (!payload.content || typeof payload.content !== 'object') {
    errors.push({ field: 'content', message: 'content must be an object' });
  }
  return { valid: errors.length === 0, errors };
}

export async function rollbackTemplate(templateId: string, targetVersion: string): Promise<TemplateDetail> {
  await ensureSchema();
  const { result, latencyMs } = await timeIt('registry.rollbackTemplate', async () => withTransaction(async () => {
    const templateRes = await query<TemplateRow>(`select * from nofx.template_registry where template_id = $1 limit 1`, [templateId]);
    const templateRow = templateRes.rows[0];
    if (!templateRow) throw new Error('template not found');

    const versionRes = await query<TemplateVersionRow>(
      `select * from nofx.template_versions where template_id = $1 and version = $2 limit 1`,
      [templateRow.id, targetVersion]
    );
    if (!versionRes.rows[0]) throw new Error('target version not found');

    await query(`update nofx.template_versions set status = case when version = $2 then 'published' else 'archived' end where template_id = $1`, [templateRow.id, targetVersion]);
    await query(`update nofx.template_registry set current_version = $2, status = 'published', updated_at = now() where id = $1`, [templateRow.id, targetVersion]);

    const detail = await getTemplate(templateId);
    if (!detail) throw new Error('failed to load template after rollback');
    return detail;
  }));
  try { metrics.registryOperationDuration.observe({ entity: 'template', action: 'rollback' }, latencyMs); } catch {}
  log.info({ event: 'registry.template.rollback', templateId, targetVersion, latencyMs }, 'Template rolled back');
  return result as TemplateDetail;
}
