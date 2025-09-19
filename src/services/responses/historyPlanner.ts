export type HistoryPreference = 'prefer_vendor' | 'prefer_replay';

export interface HistoryPlannerConfig {
  contextWindowTokens: number;
  denseHistoryEventThreshold?: number;
}

export interface HistoryPlanInput {
  estimatedTokens: number;
  eventCount: number;
  truncation: 'auto' | 'disabled';
  preference?: HistoryPreference;
}

export interface HistoryPlan {
  strategy: 'vendor' | 'replay';
  trimmedEvents: number;
  warnings: string[];
}

const DEFAULT_EVENT_THRESHOLD = 500;

export class HistoryPlanner {
  private readonly contextWindowTokens: number;

  private readonly denseThreshold: number;

  constructor(config: HistoryPlannerConfig) {
    this.contextWindowTokens = config.contextWindowTokens;
    this.denseThreshold = config.denseHistoryEventThreshold ?? DEFAULT_EVENT_THRESHOLD;
  }

  plan(input: HistoryPlanInput): HistoryPlan {
    const warnings: string[] = [];

    if (input.truncation === 'disabled' && input.estimatedTokens > this.contextWindowTokens) {
      warnings.push('Truncation disabled but estimated tokens exceed model context window; opting for vendor conversation.');
      return { strategy: 'vendor', trimmedEvents: 0, warnings };
    }

    if (
      input.preference !== 'prefer_replay' &&
      input.eventCount >= this.denseThreshold &&
      input.estimatedTokens > this.contextWindowTokens * 0.6
    ) {
      warnings.push('History very dense; switching to vendor conversation for efficiency.');
      return { strategy: 'vendor', trimmedEvents: 0, warnings };
    }

    const trimmedEvents = this.calculateTrimmedEvents(input.estimatedTokens, input.eventCount, warnings);

    return {
      strategy: 'replay',
      trimmedEvents,
      warnings,
    };
  }

  private calculateTrimmedEvents(tokens: number, eventCount: number, warnings: string[]): number {
    if (tokens <= this.contextWindowTokens || eventCount === 0) {
      return 0;
    }

    const tokensPerEvent = Math.max(tokens / Math.max(eventCount, 1), 1);
    const excessTokens = tokens - this.contextWindowTokens;
    const eventsToTrim = Math.min(eventCount, Math.ceil(excessTokens / tokensPerEvent));
    if (eventsToTrim > 0) {
      warnings.push(`Trimmed ${eventsToTrim} events from replay to respect context window.`);
    }
    return eventsToTrim;
  }
}
