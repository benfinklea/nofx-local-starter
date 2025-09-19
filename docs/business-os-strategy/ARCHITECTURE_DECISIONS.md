# Architecture Decision Records (ADRs)

This document captures the key architectural decisions made during the evolution of NOFX into a Business Operating System platform.

## ADR-001: Layered Architecture Over Monolithic Expansion

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Engineering Team

### Context

We need to evolve NOFX from a workflow engine into a platform that supports business automation with user-friendly interfaces like the Narrative OS. We considered three approaches:

1. **Expand NOFX directly** - Add business features to the core
2. **Fork NOFX** - Create a business-specific variant
3. **Layered architecture** - Keep NOFX core, build business layer on top

### Decision

We will implement a **layered architecture** where:
- NOFX remains a focused workflow orchestration engine
- Business abstractions are built as a separate service layer
- User interfaces consume the business layer APIs
- The business layer uses NOFX for workflow execution

### Rationale

**Chosen approach advantages**:
- Preserves NOFX as a general-purpose tool
- Enables rapid iteration on business features
- Clean separation of concerns
- Multiple UI paradigms possible
- Independent scaling and deployment

**Rejected alternatives**:
- **Direct expansion**: Would bloat NOFX core, reduce maintainability
- **Fork**: Would duplicate maintenance effort, split ecosystem

### Consequences

**Positive**:
- NOFX remains maintainable and focused
- Business layer can evolve independently
- Clear API boundaries
- Multiple interface options (narrative, dashboard, mobile)

**Negative**:
- Some development overhead
- Need to maintain API contracts
- Slight performance overhead from layers

## ADR-002: Minimal NOFX Enhancements Only

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Engineering Team

### Context

To support business applications, NOFX needs some enhancements. We could either:
1. Add comprehensive business features to NOFX
2. Add minimal abstractions that enable business layer development
3. Keep NOFX unchanged and handle everything in business layer

### Decision

We will add **minimal enhancements** to NOFX core:
- Entity references (pointer to business objects)
- Document pointers (file/artifact management)
- Policy hooks (extensible business rule evaluation)
- External adapters (plugin interface for integrations)
- Business event types (semantic event metadata)

### Rationale

**Why minimal enhancements**:
- Provides necessary primitives without business logic
- Maintains NOFX's general-purpose nature
- Enables rich business applications in upper layers
- Low risk of scope creep

**Why not comprehensive**:
- Would make NOFX business-specific
- Increases complexity and maintenance burden
- Harder to use for non-business workflows

**Why not unchanged**:
- Would require complex workarounds in business layer
- Poor performance for business use cases
- Limited extensibility

### Consequences

**Positive**:
- NOFX stays focused and reusable
- Business layer has necessary hooks
- Easy to extend with new business domains
- Backward compatibility maintained

**Negative**:
- Some features span both layers
- Need careful API design for extension points

## ADR-003: Business OS as Separate Service

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Engineering Team, Product Team

### Context

The Business OS layer needs to provide entity management, document storage, policy evaluation, and other business abstractions. We considered:

1. **Embedded library** - Business logic as npm package used by NOFX
2. **Separate microservice** - Independent service that calls NOFX APIs
3. **Monolithic addition** - Add business features directly to NOFX API

### Decision

We will build Business OS as a **separate microservice** that:
- Maintains its own database for business entities
- Uses NOFX client library for workflow execution
- Provides its own REST/GraphQL APIs
- Handles business logic independently

### Rationale

**Why separate service**:
- Independent deployment and scaling
- Clear ownership boundaries
- Can use different tech stack if needed
- Easy to test in isolation
- Multiple NOFX instances can share one Business OS

**Why not embedded library**:
- Would still bloat NOFX deployment
- Harder to version independently
- Shared state management complexity

**Why not monolithic**:
- Violates single responsibility principle
- Would make NOFX less reusable
- Harder to maintain

### Consequences

**Positive**:
- Clean separation of concerns
- Independent evolution possible
- Easy to reason about
- Multiple deployment options

**Negative**:
- Network overhead between services
- Need service discovery/communication
- Distributed system complexity

## ADR-004: Story-First Narrative Interface

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Product Team, UX Team

### Context

For the Narrative OS interface, we considered several approaches:

1. **Story-first** - User writes business narrative, system compiles to workflow
2. **Visual-first** - Drag-and-drop interface with narrative annotation
3. **Hybrid** - Both narrative and visual editing modes
4. **Template-first** - Pre-built business templates with customization

### Decision

We will implement a **story-first** approach where:
- Primary interface is a narrative text editor
- Real-time compilation shows visual representation
- Characters are extracted from story automatically
- Visual elements are read-only previews of compiled workflow

### Rationale

**Why story-first**:
- Most natural for entrepreneurs (think in stories)
- Lowest learning curve (everyone can write)
- Differentiates from existing workflow tools
- Enables voice input in future
- Self-documenting (story is the spec)

**Why not visual-first**:
- Would be similar to existing tools (Zapier, n8n)
- Higher learning curve
- Less accessible to non-technical users

**Why not hybrid**:
- Would complicate UI significantly
- Risk of feature confusion
- Harder to maintain consistency

**Why not template-first**:
- Less flexible for unique business needs
- Harder to understand what's happening
- Templates can be added later

### Consequences

**Positive**:
- Unique user experience
- Very accessible to entrepreneurs
- Natural language is future-proof
- Stories provide documentation

**Negative**:
- NLP parsing complexity
- Need sophisticated error handling
- May be too novel for some users

## ADR-005: Character-Based Business Function Abstraction

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Product Team, Engineering Team

### Context

The Narrative OS needs to map story elements to business functions. We considered:

1. **Character-based** - Business functions as personas with personalities
2. **Service-based** - Direct mapping to business service APIs
3. **Agent-based** - AI agents that perform business tasks
4. **Tool-based** - Business tools that users configure

### Decision

We will use **character-based** abstraction where:
- Business functions are represented as characters with personalities
- Characters have roles that map to underlying handlers/APIs
- Personalities modify behavior (formal vs casual, fast vs careful)
- Characters can interact with each other in stories

### Rationale

**Why character-based**:
- Makes system feel alive and approachable
- Personalities enable behavior customization
- Natural mapping to story narratives
- Creates emotional connection for users
- Enables character development over time

**Why not service-based**:
- Too technical for target audience
- No personality or customization
- Harder to create engaging stories

**Why not agent-based**:
- Too complex for MVP
- Unpredictable behavior
- Harder to debug and control

**Why not tool-based**:
- Less engaging for story creation
- Doesn't leverage narrative metaphor
- Similar to existing workflow tools

### Consequences

**Positive**:
- Engaging and memorable user experience
- Natural behavior customization
- Strong narrative coherence
- Differentiates from competition

**Negative**:
- Need to design personality systems
- Risk of anthropomorphizing too much
- May confuse some users initially

## ADR-006: PostgreSQL for Business Entity Storage

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Engineering Team

### Context

The Business OS needs to store entities, relationships, and business data. We considered:

1. **PostgreSQL** - Relational database with JSON support
2. **MongoDB** - Document database for flexible schemas
3. **Graph database** - Neo4j or Amazon Neptune for relationships
4. **Multi-model** - Combination of databases for different needs

### Decision

We will use **PostgreSQL** as the primary database for Business OS with:
- Entities stored as rows with JSONB attributes
- Relationships as separate table with referential integrity
- Audit trail using temporal tables
- Full-text search using built-in capabilities

### Rationale

**Why PostgreSQL**:
- Excellent JSONB support for flexible attributes
- Strong consistency and ACID properties
- Rich query capabilities including relationships
- Team expertise and operational maturity
- Good performance for expected scale
- Built-in full-text search
- Temporal table support for audit trails

**Why not MongoDB**:
- Weaker consistency guarantees
- No referential integrity
- Would require separate service for NOFX data

**Why not graph database**:
- Overkill for expected relationship complexity
- Additional operational overhead
- Limited team expertise
- Complex query language

**Why not multi-model**:
- Operational complexity
- Data consistency challenges
- Would delay MVP delivery

### Consequences

**Positive**:
- Single database to operate
- Strong consistency for business data
- Flexible schema with JSONB
- Rich querying capabilities
- Familiar technology stack

**Negative**:
- May need optimization for complex relationships
- JSONB queries can be slower than native types

## ADR-007: Gradual Migration Strategy

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Engineering Team, Operations Team

### Context

Rolling out the layered architecture requires careful migration planning. We considered:

1. **Big bang** - Deploy all changes at once
2. **Feature flags** - Gradual rollout of new features
3. **Blue-green** - Parallel deployment with traffic switching
4. **Strangler fig** - Gradually replace functionality

### Decision

We will use **feature flags** with gradual rollout:
- NOFX enhancements behind feature flags
- Business OS deployed as optional service initially
- Narrative OS as separate frontend application
- Gradual migration of workflows to new system

### Rationale

**Why feature flags**:
- Low risk rollout strategy
- Easy rollback if issues found
- Can validate each component separately
- Allows user testing in production
- Maintains service availability

**Why not big bang**:
- High risk of system-wide issues
- Difficult to isolate problems
- Would require extensive staging testing

**Why not blue-green**:
- Overkill for incremental changes
- Doubles infrastructure requirements
- Complex for gradual feature rollout

**Why not strangler fig**:
- We're adding new capabilities, not replacing existing
- Would be more complex than needed

### Consequences

**Positive**:
- Very low risk deployment strategy
- Easy to test and validate
- Can gather user feedback early
- Maintains system stability

**Negative**:
- Feature flag management overhead
- Longer rollout timeline
- Need to maintain both old and new code paths temporarily

## ADR-008: REST API with GraphQL for Complex Queries

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Frontend Team, Backend Team

### Context

The Business OS needs to expose APIs for the Narrative OS frontend and external integrations. We considered:

1. **REST only** - Traditional RESTful APIs
2. **GraphQL only** - Single endpoint with flexible queries
3. **gRPC** - High-performance binary protocol
4. **Hybrid** - REST for CRUD, GraphQL for complex queries

### Decision

We will implement a **hybrid approach**:
- REST APIs for standard CRUD operations
- GraphQL endpoint for complex entity relationships and queries
- Real-time updates via Server-Sent Events or WebSockets
- OpenAPI specification for REST endpoints

### Rationale

**Why hybrid approach**:
- REST is simple for basic operations
- GraphQL excels at relationship queries
- Leverages strengths of both approaches
- Easy for external integrations (REST)
- Efficient for frontend data fetching (GraphQL)

**Why not REST only**:
- Would require many round trips for relationship data
- Over-fetching and under-fetching issues
- Complex query parameters for advanced features

**Why not GraphQL only**:
- Learning curve for external integrators
- Caching complexity
- Overkill for simple CRUD operations

**Why not gRPC**:
- Less accessible for web frontends
- Limited ecosystem compared to REST/GraphQL
- Unnecessary performance optimization for MVP

### Consequences

**Positive**:
- Best tool for each use case
- Efficient frontend data fetching
- Simple external integration
- Future-proof for mobile apps

**Negative**:
- More API surface to maintain
- Need expertise in both approaches
- Documentation for two API styles

## ADR-009: Event Sourcing for Audit Trail

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Engineering Team, Compliance Advisor

### Context

Business applications require comprehensive audit trails for compliance and debugging. We considered:

1. **Event sourcing** - Store all changes as events
2. **Audit logs** - Separate audit table with change records
3. **Database triggers** - Automatic change tracking
4. **Temporal tables** - Built-in versioning in PostgreSQL

### Decision

We will implement **event sourcing** for business-critical entities:
- All state changes stored as immutable events
- Current state derived from event stream
- Events provide complete audit trail
- Snapshots for performance optimization

### Rationale

**Why event sourcing**:
- Complete, immutable audit trail
- Natural fit for business processes
- Enables time-travel debugging
- Supports compliance requirements
- Can replay events for testing
- Aligns with NOFX event system

**Why not audit logs**:
- Can miss changes if not properly implemented
- Doesn't capture intent, only results
- Harder to ensure completeness

**Why not database triggers**:
- Database-specific implementation
- Can be bypassed by direct database access
- Limited metadata about changes

**Why not temporal tables**:
- PostgreSQL-specific feature
- Less flexible than event sourcing
- Harder to capture business semantics

### Consequences

**Positive**:
- Bulletproof audit trail
- Excellent debugging capabilities
- Compliance-ready from day one
- Enables advanced analytics

**Negative**:
- More complex than simple CRUD
- Storage overhead from events
- Need event schema migration strategy

## ADR-010: Security Model with Row-Level Security

**Date**: 2025-09-15
**Status**: Accepted
**Deciders**: Engineering Team, Security Team

### Context

Multi-tenant business applications require strong data isolation. We considered:

1. **Application-level** - Security enforced in application code
2. **Database-level** - Row-level security in PostgreSQL
3. **Schema-per-tenant** - Separate database schemas
4. **Database-per-tenant** - Separate databases

### Decision

We will implement **database-level security** using PostgreSQL RLS:
- Row-level security policies based on project/tenant ID
- Application context sets current user/tenant
- Backup enforcement in application layer
- API keys scoped to specific tenants

### Rationale

**Why database-level RLS**:
- Security enforced even if application bugs exist
- Cannot be bypassed by direct database access
- PostgreSQL RLS is mature and performant
- Simpler than schema/database separation
- Works well with shared infrastructure

**Why not application-level only**:
- Security bugs could expose data
- Complex to implement correctly everywhere
- No protection against database access

**Why not schema-per-tenant**:
- Schema proliferation complexity
- Harder to query across tenants for admin
- Migration complexity

**Why not database-per-tenant**:
- Operational overhead
- Cost implications
- Backup and monitoring complexity

### Consequences

**Positive**:
- Strong data isolation guarantees
- Defense in depth security
- Simpler operational model
- Cost-effective scaling

**Negative**:
- Need to carefully manage RLS policies
- Query performance considerations
- Debugging can be more complex

## Implementation Guidelines

### Adding New ADRs

When making significant architectural decisions:

1. **Document the context** - What problem are we solving?
2. **List alternatives** - What options did we consider?
3. **Explain the decision** - Which option did we choose and why?
4. **Identify consequences** - What are the positive and negative impacts?
5. **Update status** - Proposed → Accepted → Deprecated/Superseded

### ADR Status Values

- **Proposed** - Decision under consideration
- **Accepted** - Decision made and implemented
- **Deprecated** - No longer valid but kept for history
- **Superseded** - Replaced by a newer ADR

### Review Process

All ADRs should be:
- Reviewed by relevant team members
- Updated when circumstances change
- Referenced in code and documentation
- Used to guide implementation decisions

---

*This document captures our architectural journey and should be updated as we learn and evolve the system. ADRs help us understand not just what we built, but why we built it that way.*