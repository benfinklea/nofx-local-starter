/**
 * Reasoning Collection Service - extracted from streamBuffer.ts
 * Handles reasoning summaries and refusal collection
 */

import type { ReasoningSummaryEvent, RefusalEvent } from './types';

export class ReasoningCollectionService {
  private readonly reasoning: string[] = [];
  private readonly refusals: string[] = [];

  addReasoningSummary(event: ReasoningSummaryEvent): void {
    this.reasoning.push(event.part.text);
  }

  addRefusal(event: RefusalEvent): void {
    this.refusals.push(event.refusal);
  }

  getReasoningSummaries(): string[] {
    return [...this.reasoning];
  }

  getRefusals(): string[] {
    return [...this.refusals];
  }
}