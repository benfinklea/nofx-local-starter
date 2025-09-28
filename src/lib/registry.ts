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
  AgentVersionSummary,
  AgentCapability
} from '../../packages/shared/src/agents';
import type {
  TemplateSummary,
  TemplateDetail,
  PublishTemplateRequest,
  ListTemplatesQuery,
  ListTemplatesResponse,
  ValidateTemplateResponse,
  TemplateVersionSummary,
  TemplateSortOption,
  SubmitTemplateRatingRequest,
  SubmitTemplateRatingResponse
} from '../../packages/shared/src/templates';

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  try {
    await query(`select 1 from nofx.agent_registry limit 1`);
    await query(`select 1 from nofx.template_registry limit 1`);
    await query(`select 1 from nofx.template_usage_daily limit 1`);
    await query(`select 1 from nofx.template_feedback limit 1`);
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

type CapabilityLike = {
  id?: unknown;
  label?: unknown;
  description?: unknown;
};

function mapCapabilities(value: unknown): AgentCapability[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is CapabilityLike => typeof entry === 'object' && entry !== null && 'id' in entry && 'label' in entry)
    .map((entry) => ({
      id: String(entry.id ?? ''),
      label: String(entry.label ?? ''),
      description:
        entry.description !== undefined && entry.description !== null
          ? String(entry.description)
          : undefined
    }))
    .filter((entry) => entry.id !== '' && entry.label !== '');
}

function mapAgentRow(row: AgentRow): AgentSummary {
  return {
    id: row.id,
    agentId: row.agent_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as AgentSummary['status'],
    currentVersion: row.current_version,
    capabilities: mapCapabilities(row.capabilities),
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

type TemplateMetrics = {
  usageCount30d: number;
  successCount30d: number;
  failureCount30d: number;
  successRate30d: number;
  averageDurationSeconds?: number;
  averageTokenUsage?: number;
  lastRunAt?: string;
};

type TemplateRatingAggregate = {
  ratingAverage?: number;
  ratingCount?: number;
};

function mapTemplateRow(row: TemplateRow, metrics?: TemplateMetrics, rating?: TemplateRatingAggregate): TemplateSummary {
  const popularityScore = metrics
    ? Number.isFinite(metrics.usageCount30d) && Number.isFinite(metrics.successRate30d)
      ? Math.round(metrics.usageCount30d * metrics.successRate30d * 100) / 100
      : undefined
    : undefined;

  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as TemplateSummary['status'],
    currentVersion: row.current_version,
    tags: Array.isArray(row.tags) ? row.tags : [],
    category: row.category ?? undefined,
    popularityScore,
    ratingAverage: rating?.ratingAverage,
    ratingCount: rating?.ratingCount,
    updatedAt: row.updated_at
  };
}

function mapTemplateDetail(row: TemplateRow, versions: TemplateVersionSummary[], metrics?: TemplateMetrics, rating?: TemplateRatingAggregate): TemplateDetail {
  return {
    ...mapTemplateRow(row, metrics, rating),
    versions,
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
    analytics: metrics
      ? {
          usageCount30d: metrics.usageCount30d,
          successCount30d: metrics.successCount30d,
          failureCount30d: metrics.failureCount30d,
          successRate30d: metrics.successRate30d,
          averageDurationSeconds: metrics.averageDurationSeconds,
          averageTokenUsage: metrics.averageTokenUsage,
          lastRunAt: metrics.lastRunAt
        }
      : {
          usageCount30d: 0,
          successCount30d: 0,
          failureCount30d: 0,
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

type TemplateMetricsQueryRow = {
  template_id: string;
  usage_count_30d: string | number | null;
  success_count_30d: string | number | null;
  total_duration_ms_30d: string | number | null;
  total_token_usage_30d: string | number | null;
  last_run_at: string | null;
};

async function loadTemplateMetrics(templateIds: string[]): Promise<Map<string, TemplateMetrics>> {
  if (!templateIds.length) return new Map();

  const res = await query<TemplateMetricsQueryRow>(
    `select
       template_id,
       sum(usage_count)::bigint as usage_count_30d,
       sum(success_count)::bigint as success_count_30d,
       sum(total_duration_ms)::bigint as total_duration_ms_30d,
       sum(total_token_usage)::bigint as total_token_usage_30d,
       max(last_run_at) as last_run_at
     from nofx.template_usage_daily
     where template_id = any($1::uuid[])
       and day >= current_date - interval '30 days'
     group by template_id`,
    [templateIds]
  );

  const metrics = new Map<string, TemplateMetrics>();
  for (const row of res.rows) {
    const usageCount = Number(row.usage_count_30d ?? 0);
    const successCount = Number(row.success_count_30d ?? 0);
    const failureCount = Math.max(usageCount - successCount, 0);
    const successRate = usageCount > 0 ? successCount / usageCount : 0;
    const avgDurationSeconds = usageCount > 0 && row.total_duration_ms_30d !== null
      ? Number(row.total_duration_ms_30d) / usageCount / 1000
      : undefined;
    const avgTokenUsage = usageCount > 0 && row.total_token_usage_30d !== null
      ? Number(row.total_token_usage_30d) / usageCount
      : undefined;

    metrics.set(row.template_id, {
      usageCount30d: usageCount,
      successCount30d: successCount,
      failureCount30d: failureCount,
      successRate30d: successRate,
      averageDurationSeconds: avgDurationSeconds,
      averageTokenUsage: avgTokenUsage,
      lastRunAt: row.last_run_at ?? undefined
    });
  }

  return metrics;
}

type TemplateRatingQueryRow = {
  template_id: string;
  average_rating: string | number | null;
  rating_count: string | number;
};

async function loadTemplateRatings(templateIds: string[]): Promise<Map<string, TemplateRatingAggregate>> {
  if (!templateIds.length) return new Map();

  const res = await query<TemplateRatingQueryRow>(
    `select template_id, avg(rating)::numeric as average_rating, count(*)::bigint as rating_count
       from nofx.template_feedback
      where template_id = any($1::uuid[])
      group by template_id`,
    [templateIds]
  );

  const ratings = new Map<string, TemplateRatingAggregate>();
  for (const row of res.rows) {
    const ratingCount = Number(row.rating_count ?? 0);
    ratings.set(row.template_id, {
      ratingAverage: row.average_rating !== null ? Number(row.average_rating) : undefined,
      ratingCount
    });
  }

  return ratings;
}

function encodeTemplateCursor(row: TemplateRow): string {
  return Buffer.from(`${row.updated_at}::${row.id}`, 'utf8').toString('base64url');
}

function decodeTemplateCursor(cursor: string): { updatedAt: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [updatedAt, id] = decoded.split('::');
    if (!updatedAt || !id) return null;
    return { updatedAt, id };
  } catch {
    return null;
  }
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

  let cursorFilter: { updatedAt: string; id: string } | null = null;
  if (queryParams.cursor) {
    cursorFilter = decodeTemplateCursor(queryParams.cursor);
    if (!cursorFilter) {
      throw new Error('Invalid cursor');
    }
    params.push(cursorFilter.updatedAt);
    const updatedIdx = params.length;
    params.push(cursorFilter.id);
    const idIdx = params.length;
    conditions.push(`(updated_at, id) < ($${updatedIdx}, $${idIdx})`);
  }

  const limit = Math.min(Math.max(queryParams.limit ?? 25, 1), 100);
  const paginationLimit = limit + 1;
  let sql = `select * from nofx.template_registry`;
  if (conditions.length) {
    sql += ` where ${conditions.join(' and ')}`;
  }
  sql += ` order by updated_at desc, id desc limit ${paginationLimit}`;

  const { result, latencyMs } = await timeIt('registry.listTemplates', async () =>
    query<TemplateRow>(sql, params)
  );
  try { metrics.registryOperationDuration.observe({ entity: 'template', action: 'list' }, latencyMs); } catch {}
  const rows = result.rows;
  const hasMore = rows.length > limit;
  const pagedRows = hasMore ? rows.slice(0, limit) : rows;
  const ids = pagedRows.map((row) => row.id);
  const [metricsMap, ratingsMap] = await Promise.all([
    loadTemplateMetrics(ids),
    loadTemplateRatings(ids)
  ]);
  let summaries = pagedRows.map((row) => mapTemplateRow(row, metricsMap.get(row.id), ratingsMap.get(row.id)));

  const sortOrder: TemplateSortOption = queryParams.sort ?? 'recent';
  if (sortOrder === 'popular') {
    summaries = summaries.sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0));
  } else if (sortOrder === 'rating') {
    summaries = summaries.sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0));
  }

  const nextCursor = hasMore && sortOrder === 'recent' && pagedRows.length
    ? encodeTemplateCursor(pagedRows[pagedRows.length - 1])
    : undefined;

  return {
    templates: summaries,
    nextCursor
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
  const [metricsMap, ratingsMap] = await Promise.all([
    loadTemplateMetrics([templateRow.id]),
    loadTemplateRatings([templateRow.id])
  ]);
  return mapTemplateDetail(
    templateRow,
    versions,
    metricsMap.get(templateRow.id),
    ratingsMap.get(templateRow.id)
  );
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

type RecordTemplateUsageOptions = {
  templateId: string;
  outcome: 'success' | 'failure';
  durationMs?: number;
  tokenUsage?: number;
};

export async function recordTemplateUsage({ templateId, outcome, durationMs, tokenUsage }: RecordTemplateUsageOptions): Promise<void> {
  if (!templateId) throw new Error('templateId is required');
  await ensureSchema();

  const successIncrement = outcome === 'success' ? 1 : 0;
  const durationIncrement = Math.max(durationMs ?? 0, 0);
  const tokenIncrement = Math.max(tokenUsage ?? 0, 0);

  await withTransaction(async () => {
    const templateRes = await query<TemplateRow>(`select id from nofx.template_registry where template_id = $1 limit 1`, [templateId]);
    const templateRow = templateRes.rows[0];
    if (!templateRow) throw new Error('template not found');

    await query(
      `insert into nofx.template_usage_daily (template_id, day, usage_count, success_count, total_duration_ms, total_token_usage, last_run_at)
       values ($1, current_date, 1, $2, $3, $4, now())
       on conflict (template_id, day)
       do update set
         usage_count = nofx.template_usage_daily.usage_count + 1,
         success_count = nofx.template_usage_daily.success_count + excluded.success_count,
         total_duration_ms = nofx.template_usage_daily.total_duration_ms + excluded.total_duration_ms,
         total_token_usage = nofx.template_usage_daily.total_token_usage + excluded.total_token_usage,
         last_run_at = excluded.last_run_at,
         updated_at = now()`,
      [templateRow.id, successIncrement, durationIncrement, tokenIncrement]
    );
  });
}

export async function submitTemplateRating(payload: SubmitTemplateRatingRequest): Promise<SubmitTemplateRatingResponse> {
  if (!payload.templateId) throw new Error('templateId is required');
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) {
    throw new Error('rating must be an integer between 1 and 5');
  }

  await ensureSchema();

  const result = await withTransaction(async () => {
    const templateRes = await query<TemplateRow>(`select id from nofx.template_registry where template_id = $1 limit 1`, [payload.templateId]);
    const templateRow = templateRes.rows[0];
    if (!templateRow) throw new Error('template not found');

    await query(
      `insert into nofx.template_feedback (template_id, rating, comment, submitted_by)
       values ($1, $2, $3, $4)`,
      [templateRow.id, payload.rating, payload.comment ?? null, payload.submittedBy ?? null]
    );

    const aggregate = await query<{ average_rating: string | number | null; rating_count: string | number }>(
      `select avg(rating)::numeric as average_rating, count(*)::bigint as rating_count
         from nofx.template_feedback
        where template_id = $1`,
      [templateRow.id]
    );

    const row = aggregate.rows[0];
    return {
      averageRating: row?.average_rating !== null && row?.average_rating !== undefined ? Number(row.average_rating) : 0,
      ratingCount: row?.rating_count !== undefined ? Number(row.rating_count) : 0
    } satisfies SubmitTemplateRatingResponse;
  });

  return result;
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
