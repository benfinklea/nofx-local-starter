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

## Zero-Barrier Project Onboarding for Non-GitHub Users
**The Problem**: Currently, users without a GitHub account are completely blocked from using NofX. This violates the core philosophy of "Democratizing Entrepreneurship Through Accessible Software Development" and excludes non-technical entrepreneurs who are exactly the target audience.

**Current State**:
- Users must have a GitHub account as a prerequisite
- Users must connect via GitHub OAuth
- This is acceptable short-term but creates friction for the target market

**Strategic Options to Consider**:

### Option 1: GitHub Account Creation Wizard
- Detect when user lacks GitHub account
- Provide step-by-step guided walkthrough
- Help create first repository
- **Pros**: Teaches valuable skill, leverages free platform, quick to implement
- **Cons**: Still requires learning GitHub concepts, adds onboarding friction

### Option 2: Auto-Managed GitHub Accounts
- NofX creates/manages GitHub account on user's behalf via API
- Or: User authorizes NofX to fork template repos
- **Pros**: Zero learning curve, immediate start
- **Cons**: GitHub ToS concerns, lacks transparency, API limitations

### Option 3: NofX-Hosted Starter Templates (RECOMMENDED)
- Create `nofx-templates` GitHub organization with curated business templates
- Templates: "Restaurant Inventory", "Customer CRM", "E-commerce Store", etc.
- User picks template → NofX forks to managed namespace → User starts working immediately
- Later: Offer "Move to your own GitHub account" graduation path

**Implementation Phases**:
1. **Phase 1 (Immediate)**: Build 3 starter templates, create template gallery UI
2. **Phase 2 (Growth)**: After users build confidence, guide them to create personal GitHub accounts and transfer ownership

**Key Philosophy Alignment**:
- ✅ "Accessible Over Advanced" - Start simple, graduate to complexity
- ✅ "Iteration Over Perfection" - Use templates that work, customize later
- ✅ "Confidence Over Complexity" - Proven templates reduce fear
- ✅ "Economic Justice" - No prerequisite knowledge required

**Decision Required**:
- Which approach best serves non-technical entrepreneurs?
- How do we balance ease-of-use with teaching valuable skills?
- What's the right graduation path from templates to self-managed projects?

**Technical Questions**:
- Can NofX create/manage repos via GitHub API without requiring each user to install our GitHub App?
- What are the GitHub API rate limits for organizational repository management?
- Should repos be created under a NofX organization or user-specific namespaces?
