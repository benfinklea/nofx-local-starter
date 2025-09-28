export type TemplateStatus = 'draft' | 'published' | 'archived';

export interface TemplateSummary {
  id: string;
  templateId: string;
  name: string;
  description?: string;
  status: TemplateStatus;
  currentVersion: string;
  tags: string[];
  category?: string;
  popularityScore?: number;
  updatedAt: string;
}

export interface TemplateDetail extends TemplateSummary {
  ownerId?: string;
  createdAt: string;
  versions: TemplateVersionSummary[];
  analytics?: TemplateAnalytics;
  metadata?: Record<string, unknown>;
}

export interface TemplateVersionSummary {
  id: string;
  version: string;
  status: TemplateStatus;
  publishedAt: string;
  checksum?: string;
  changeSummary?: string;
}

export interface TemplateAnalytics {
  usageCount30d: number;
  successRate30d: number;
  averageDurationSeconds?: number;
  averageTokenUsage?: number;
}

export interface PublishTemplateRequest {
  templateId: string;
  name: string;
  description?: string;
  content: Record<string, unknown>;
  version: string;
  tags?: string[];
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishTemplateResponse {
  template: TemplateDetail;
}

export interface ListTemplatesQuery {
  status?: TemplateStatus;
  tag?: string;
  category?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

export interface ListTemplatesResponse {
  templates: TemplateSummary[];
  nextCursor?: string;
}

export interface ValidateTemplateResponse {
  valid: boolean;
  errors: { field: string; message: string }[];
}
