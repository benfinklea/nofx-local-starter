/**
 * Image Artifact Service - extracted from streamBuffer.ts
 * Handles image generation partial and completion events
 */

import type {
  ImagePartialEvent,
  ImageCompletedEvent,
  ImageAccumulator,
} from './types';

export class ImageArtifactService {
  private readonly images = new Map<string, ImageAccumulator>();
  private readonly imageOrder: string[] = [];

  appendImagePartial(event: ImagePartialEvent): void {
    const acc = this.getImageAccumulator(event.item_id);
    if (event.partial_image_b64) {
      acc.partials.push(event.partial_image_b64);
    }
  }

  finalizeImage(event: ImageCompletedEvent): void {
    const acc = this.getImageAccumulator(event.item_id);
    acc.b64 = event.b64_json ?? acc.b64;
    if (event.image_url) {
      acc.imageUrl = event.image_url;
    }
    if (event.background !== undefined) {
      acc.background = event.background;
    }
    if (event.size) {
      acc.size = event.size;
    }
    if (event.created_at) {
      acc.createdAt = new Date(event.created_at * 1000).toISOString();
    }
  }

  getImageArtifacts() {
    const artifacts: Array<{ itemId: string; b64JSON?: string; imageUrl?: string; background?: string | null; size?: string; createdAt?: string }> = [];
    for (const id of this.imageOrder) {
      const acc = this.images.get(id);
      if (!acc) continue;
      artifacts.push({
        itemId: id,
        b64JSON: acc.b64 ?? (acc.partials.length ? acc.partials[acc.partials.length - 1] : undefined),
        imageUrl: acc.imageUrl,
        background: acc.background ?? null,
        size: acc.size,
        createdAt: acc.createdAt,
      });
    }
    return artifacts;
  }

  private getImageAccumulator(id: string): ImageAccumulator {
    if (!this.images.has(id)) {
      this.images.set(id, { partials: [] });
      this.imageOrder.push(id);
    }
    return this.images.get(id)!;
  }
}