# Template Marketplace Enhancements (Phase 1B)

Phase 1B introduces the foundation for a template marketplace layered on top of the Supabase registry. This document captures the new capabilities, storage primitives, and operational workflows delivered in this milestone.

## What Shipped

- **Usage Analytics** – Every template can now accumulate rolling 30-day metrics (runs, success rate, average duration, token consumption) via the `nofx.template_usage_daily` table. Marketplace surfaces popularity using these aggregates.
- **Community Ratings** – Admins (and future contributors) can submit 1–5 star feedback with optional notes. Ratings are persisted in `nofx.template_feedback` and exposed as aggregate averages and counts.
- **Enhanced Listing API** – `GET /api/templates` now returns `popularityScore`, `ratingAverage`, and `ratingCount`, supports optional `sort=popular|rating`, and provides cursor pagination for the default recent view.
- **Rating Endpoint** – `POST /api/templates/rate` records feedback and returns updated averages. Designed for UI and automation hooks.
- **Registry Sync Telemetry** – `npm run registry:sync` logs rating and usage stats alongside publish events so operators can verify marketplace health straight from the CLI.

## Database Schema

Two new tables live in the `nofx` schema (see `supabase/migrations/20251001000130_template_analytics.sql`):

| Table | Purpose |
| --- | --- |
| `template_usage_daily` | Daily rollups keyed by template + day. Stores run counts, successes, cumulative duration, and token totals. |
| `template_feedback` | Individual rating submissions with optional comments and submitter metadata. |

Row Level Security is enabled with admin-all policies matching the existing registry tables.

## API Surface

### List Templates

```
GET /api/templates?status=published&sort=popular
```

Response fields now include:
- `popularityScore` – weighted usage metric (30-day runs × success rate)
- `ratingAverage` & `ratingCount`
- `nextCursor` for pagination when using the default `recent` sort

Supported query parameters:
- `status`, `tag`, `category`, `search` (existing)
- `sort` (`recent` | `popular` | `rating`)
- `limit`, `cursor`

### Submit Rating

```
POST /api/templates/rate
{
  "templateId": "builder-default",
  "rating": 5,
  "comment": "Ships with sane defaults",
  "submittedBy": "ops@nofx"
}
```

Returns the updated aggregate:

```
{
  "rating": {
    "averageRating": 4.6,
    "ratingCount": 12
  }
}
```

### Recording Usage

Template executions can be tracked by calling `recordTemplateUsage`:

```ts
import { recordTemplateUsage } from '../../src/lib/registry';

await recordTemplateUsage({
  templateId: 'builder-default',
  outcome: 'success',
  durationMs: 2800,
  tokenUsage: 920,
});
```

This helper upserts the current day’s metrics and keeps `popularityScore` fresh. Wire it into whichever service produces template runs (builder, orchestrated workflows, etc.).

## CLI Workflow

Publish or sync templates while surfacing analytics:

```
npm run registry:sync
```

Each published template now logs the latest rating and 30-day usage snapshot so operators can confirm marketplace visibility without checking the dashboard.

## Next Steps

- Surface ratings + popularity inside the builder UI alongside deployment status
- Offer public rating submissions (with throttling) once auth flows land
- Nightly job to recompute historical popularity for long-lived templates
- Alerting hooks when usage drops below thresholds

These features pave the way for Phase 1C integration work and the broader marketplace experience planned in later phases.
