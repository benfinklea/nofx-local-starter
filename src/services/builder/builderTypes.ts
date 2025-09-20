import type { ResponsesRequest } from '../../shared/openai/responsesSchemas';
import type { ConversationPolicy } from '../responses/conversationStateManager';
import type { HistoryPlanInput } from '../responses/historyPlanner';
import type { ToolRequestConfig } from '../responses/toolRegistry';

export type BuilderChannel = 'slack' | 'email' | 'inApp';
export type BuilderEnvironment = 'development' | 'staging' | 'production';

export interface BuilderDeploymentState {
  slack: boolean;
  email: boolean;
  inApp: boolean;
}

export interface BuilderTemplateHistoryEntry {
  version: number;
  description: string;
  instructions: string;
  updatedAt: string;
}

export type BuilderInputItem =
  | { id: string; type: 'input_text'; text: string }
  | { id: string; type: 'input_image'; image_url: string; detail?: 'low' | 'high' | 'auto' }
  | { id: string; type: 'input_file'; file_id: string }
  | { id: string; type: 'input_audio'; audio: string; format?: string };

export interface BuilderTemplateBase {
  name: string;
  description?: string;
  instructions: string;
  model: string;
  input: BuilderInputItem[];
  metadata?: Record<string, string>;
  channels: BuilderDeploymentState;
  tools?: ToolRequestConfig;
  maxToolCalls?: number;
  toolChoice?: ResponsesRequest['tool_choice'];
  historyPlan?: HistoryPlanInput;
  conversationPolicy?: ConversationPolicy;
}

export interface BuilderTemplate extends BuilderTemplateBase {
  id: string;
  safetyIdentifier: string;
  createdAt: string;
  updatedAt: string;
  deployments: Record<BuilderEnvironment, BuilderDeploymentState>;
  history: BuilderTemplateHistoryEntry[];
}

export type BuilderTemplateInput = BuilderTemplateBase & Partial<
  Pick<BuilderTemplate, 'id' | 'safetyIdentifier' | 'createdAt' | 'updatedAt' | 'deployments' | 'history'>
> & {
  deployments?: Partial<Record<BuilderEnvironment, BuilderDeploymentState>>;
};

export interface DeploymentToggleInput {
  templateId: string;
  environment: BuilderEnvironment;
  channel: BuilderChannel;
  enabled: boolean;
}

export interface CompileTemplateOptions {
  template: BuilderTemplate;
  tenantId: string;
  variables: Record<string, string>;
  metadata?: Record<string, string>;
}
