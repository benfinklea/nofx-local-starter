# Future Feature Ideas

## Richer Safety Instrumentation
- Track refusal, safety violation, and policy override events with structured tags written to the responses archive.
- Expose an operator dashboard widget that charts refusals per tenant, per template, and per model snapshot.
- Raise configurable alerts when refusal rates spike or when a tenant exceeds a defined safety threshold.
- Store moderation review actions (approve, modify, block) alongside the original run so audit trails remain intact.
- Emit anonymized safety telemetry to the observability pipeline for long-term trend analysis and anomaly detection.

## Automated Incident Annotations
- Auto-create incident records when the rate of failed or incomplete responses crosses a configurable SLO boundary.
- Attach context (recent deployments, queue backlog, rate-limit snapshot) to each incident entry to speed up triage.
- Provide a timeline overlay in the UI that surfaces incident start/end markers on top of the archived events stream.
- Offer a one-click postmortem export that bundles the incident record, affected runs, and remediation notes.
- Integrate with pager and issue-tracking systems so annotations sync bi-directionally with existing on-call workflows.
