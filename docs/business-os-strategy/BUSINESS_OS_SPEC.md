# Business OS Technical Specification

## Overview

The Business OS is a service layer built on top of NOFX that provides business-specific abstractions and APIs. It transforms NOFX from a general workflow engine into a comprehensive platform for business automation.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Frontend UIs                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Narrative OS │ │  Dashboard   │ │  Mobile App  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────┤
│                Business OS API Layer                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  REST API    │ │   GraphQL    │ │   WebSocket  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────┤
│              Business Logic Services                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │   Entities   │ │   Ledger     │ │  Documents   │  │
│  ├──────────────┤ ├──────────────┤ ├──────────────┤  │
│  │   Policies   │ │   Comms      │ │  External    │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────┤
│               Data Access Layer                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ PostgreSQL   │ │    Redis     │ │   File Store │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────┤
│                NOFX Integration                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ NOFX Client  │ │ Event Bridge │ │  Workflow    │  │
│  │   Library    │ │              │ │   Compiler   │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Core Components

### 1. Entity Management Service

**Purpose**: Manage business entities (customers, vendors, employees, products) with rich metadata and relationships.

#### Entity Model

```typescript
interface Entity {
  id: string;                    // UUID primary key
  projectId: string;             // Tenant isolation
  type: EntityType;              // Predefined entity types
  status: string;                // Type-specific status
  attributes: Record<string, any>; // Flexible JSON attributes
  relationships: Relationship[]; // Links to other entities
  tags: string[];               // Searchable tags

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  version: number;              // Optimistic locking
}

enum EntityType {
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  EMPLOYEE = 'employee',
  PRODUCT = 'product',
  ASSET = 'asset',
  CONTRACT = 'contract',
  PROJECT = 'project',
  INVOICE = 'invoice',
  ORDER = 'order'
}

interface Relationship {
  id: string;
  type: RelationshipType;
  target: string;               // Target entity ID
  metadata: Record<string, any>;
  validFrom: Date;
  validUntil?: Date;
  strength?: number;            // 0-1 relationship strength
}

enum RelationshipType {
  EMPLOYS = 'employs',
  MANAGES = 'manages',
  REPORTS_TO = 'reports_to',
  SELLS_TO = 'sells_to',
  BUYS_FROM = 'buys_from',
  OWNS = 'owns',
  USES = 'uses',
  DEPENDS_ON = 'depends_on',
  COMPETES_WITH = 'competes_with',
  PARTNERS_WITH = 'partners_with'
}
```

#### Entity API

```typescript
// REST API
POST   /api/entities                    // Create entity
GET    /api/entities/:id                // Get entity by ID
PUT    /api/entities/:id                // Update entity
DELETE /api/entities/:id                // Soft delete entity
GET    /api/entities                    // List entities (filtered)
POST   /api/entities/:id/relationships  // Create relationship
GET    /api/entities/:id/relationships  // Get entity relationships
GET    /api/entities/:id/history        // Get change history

// GraphQL
type Entity {
  id: ID!
  projectId: String!
  type: EntityType!
  status: String!
  attributes: JSON
  relationships: [Relationship!]!
  tags: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  version: Int!
}

type Query {
  entity(id: ID!): Entity
  entities(
    type: EntityType
    status: String
    tags: [String!]
    search: String
    limit: Int = 50
    offset: Int = 0
  ): EntitiesConnection!

  searchEntities(query: String!): [Entity!]!
  getRelated(entityId: ID!, relationshipType: RelationshipType): [Entity!]!
}

type Mutation {
  createEntity(input: CreateEntityInput!): Entity!
  updateEntity(id: ID!, input: UpdateEntityInput!): Entity!
  deleteEntity(id: ID!): Boolean!

  createRelationship(input: CreateRelationshipInput!): Relationship!
  updateRelationship(id: ID!, input: UpdateRelationshipInput!): Relationship!
  deleteRelationship(id: ID!): Boolean!
}
```

#### Entity Service Implementation

```typescript
export class EntityService {
  constructor(
    private db: Database,
    private eventBus: EventBus,
    private searchIndex: SearchIndex
  ) {}

  async createEntity(projectId: string, input: CreateEntityInput): Promise<Entity> {
    const entity = {
      id: uuidv4(),
      projectId,
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    await this.db.transaction(async (tx) => {
      await tx.query('INSERT INTO entities (...) VALUES (...)', entity);
      await this.updateSearchIndex(entity);
    });

    await this.eventBus.publish('entity.created', { entity });
    return entity;
  }

  async findByRelationship(
    entityId: string,
    relationshipType: RelationshipType
  ): Promise<Entity[]> {
    const query = `
      SELECT e.* FROM entities e
      JOIN relationships r ON e.id = r.target
      WHERE r.source = $1 AND r.type = $2 AND r.valid_until IS NULL
    `;

    return this.db.query(query, [entityId, relationshipType]);
  }

  async searchEntities(projectId: string, query: string): Promise<Entity[]> {
    // Full-text search across entity attributes and tags
    const searchResults = await this.searchIndex.search(projectId, query);
    return this.db.findByIds(searchResults.map(r => r.entityId));
  }
}
```

### 2. Ledger Service

**Purpose**: Track financial and non-financial transactions with double-entry bookkeeping principles.

#### Ledger Model

```typescript
interface Transaction {
  id: string;
  projectId: string;
  number: string;              // Human-readable transaction number
  date: Date;                  // Transaction date
  description: string;
  reference?: string;          // External reference (invoice #, etc.)

  entries: LedgerEntry[];
  tags: string[];

  // Workflow integration
  runId?: string;              // NOFX run that created this
  stepId?: string;             // Specific step

  // Audit
  createdAt: Date;
  createdBy: string;
  approvedAt?: Date;
  approvedBy?: string;

  // Reconciliation
  reconciledAt?: Date;
  reconciledBy?: string;
}

interface LedgerEntry {
  id: string;
  transactionId: string;
  account: string;             // Chart of accounts
  debit?: number;
  credit?: number;
  entity?: string;             // Related entity ID
  description?: string;

  // Multi-dimensional accounting
  dimensions?: {
    department?: string;
    project?: string;
    costCenter?: string;
    location?: string;
  };
}

interface Account {
  code: string;                // Account code (e.g., "1001")
  name: string;                // Account name (e.g., "Cash")
  type: AccountType;
  parent?: string;             // Parent account code
  active: boolean;

  // Balance tracking
  balance: number;
  debitBalance: number;
  creditBalance: number;
  lastTransactionAt?: Date;
}

enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense'
}
```

#### Ledger API

```typescript
// REST API
POST   /api/transactions                // Create transaction
GET    /api/transactions/:id            // Get transaction
PUT    /api/transactions/:id            // Update transaction
GET    /api/transactions                // List transactions
POST   /api/transactions/:id/approve    // Approve transaction

GET    /api/accounts                    // List accounts
POST   /api/accounts                    // Create account
GET    /api/accounts/:code/balance      // Get account balance
GET    /api/accounts/:code/history      // Get account history

GET    /api/reports/trial-balance       // Trial balance
GET    /api/reports/balance-sheet       // Balance sheet
GET    /api/reports/income-statement    // P&L statement
```

#### Ledger Service Implementation

```typescript
export class LedgerService {
  async createTransaction(
    projectId: string,
    input: CreateTransactionInput
  ): Promise<Transaction> {
    // Validate entries balance
    const totalDebits = input.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredits = input.entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new Error('Transaction does not balance');
    }

    const transaction = {
      id: uuidv4(),
      projectId,
      number: await this.generateTransactionNumber(projectId),
      ...input,
      createdAt: new Date()
    };

    await this.db.transaction(async (tx) => {
      await tx.query('INSERT INTO transactions (...) VALUES (...)', transaction);

      for (const entry of input.entries) {
        await tx.query('INSERT INTO ledger_entries (...) VALUES (...)', {
          ...entry,
          id: uuidv4(),
          transactionId: transaction.id
        });

        // Update account balances
        await this.updateAccountBalance(tx, entry.account, entry.debit, entry.credit);
      }
    });

    await this.eventBus.publish('transaction.created', { transaction });
    return transaction;
  }

  async generateFinancialReport(
    projectId: string,
    reportType: ReportType,
    period: DateRange
  ): Promise<FinancialReport> {
    switch (reportType) {
      case 'balance_sheet':
        return this.generateBalanceSheet(projectId, period.endDate);
      case 'income_statement':
        return this.generateIncomeStatement(projectId, period);
      case 'cash_flow':
        return this.generateCashFlowStatement(projectId, period);
    }
  }
}
```

### 3. Document Management Service

**Purpose**: Store, organize, and manage business documents with metadata and search capabilities.

#### Document Model

```typescript
interface Document {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  category: DocumentCategory;
  type: string;                // MIME type

  // Storage
  url: string;                 // Storage location
  size: number;                // File size in bytes
  hash: string;                // SHA-256 for integrity

  // Metadata
  tags: string[];
  customFields: Record<string, any>;

  // Relationships
  entities: string[];          // Related entity IDs
  transactions: string[];      // Related transaction IDs

  // Workflow
  runId?: string;
  stepId?: string;

  // Status
  status: DocumentStatus;

  // Lifecycle
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  archivedAt?: Date;

  // Retention
  retentionPolicy?: string;
  deleteAfter?: Date;
  legalHold?: boolean;

  // Extracted content (OCR, parsing)
  extractedText?: string;
  extractedData?: Record<string, any>;

  // Signatures/Attestations
  signatures: DocumentSignature[];
}

enum DocumentCategory {
  CONTRACT = 'contract',
  INVOICE = 'invoice',
  RECEIPT = 'receipt',
  REPORT = 'report',
  LEGAL = 'legal',
  COMPLIANCE = 'compliance',
  MARKETING = 'marketing',
  HR = 'hr',
  OPERATIONS = 'operations'
}

enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  SIGNED = 'signed',
  EXECUTED = 'executed',
  ARCHIVED = 'archived',
  EXPIRED = 'expired'
}

interface DocumentSignature {
  id: string;
  signerId: string;            // Entity ID of signer
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  signatureData: string;       // Digital signature
  ipAddress?: string;
  userAgent?: string;
}
```

#### Document API

```typescript
// REST API
POST   /api/documents/upload            // Upload document
GET    /api/documents/:id               // Get document metadata
GET    /api/documents/:id/download      // Download document
PUT    /api/documents/:id               // Update metadata
DELETE /api/documents/:id               // Delete document
GET    /api/documents                   // List documents
POST   /api/documents/search            // Search documents
POST   /api/documents/:id/sign          // Add signature
```

#### Document Service Implementation

```typescript
export class DocumentService {
  constructor(
    private storage: StorageService,
    private db: Database,
    private searchIndex: SearchIndex,
    private ocrService: OCRService
  ) {}

  async uploadDocument(
    projectId: string,
    file: FileUpload,
    metadata: DocumentMetadata
  ): Promise<Document> {
    // Calculate hash for integrity
    const hash = await this.calculateHash(file.buffer);

    // Store file
    const url = await this.storage.store(projectId, file.filename, file.buffer);

    // Extract text if supported
    let extractedText: string | undefined;
    if (this.isOCRSupported(file.mimetype)) {
      extractedText = await this.ocrService.extractText(file.buffer);
    }

    const document: Document = {
      id: uuidv4(),
      projectId,
      name: file.filename,
      type: file.mimetype,
      url,
      size: file.buffer.length,
      hash,
      extractedText,
      ...metadata,
      status: DocumentStatus.DRAFT,
      createdAt: new Date(),
      signatures: []
    };

    await this.db.query('INSERT INTO documents (...) VALUES (...)', document);

    // Index for search
    await this.searchIndex.index(document);

    await this.eventBus.publish('document.uploaded', { document });

    return document;
  }

  async searchDocuments(
    projectId: string,
    query: SearchQuery
  ): Promise<DocumentSearchResult> {
    const searchResults = await this.searchIndex.search(projectId, {
      text: query.text,
      categories: query.categories,
      tags: query.tags,
      dateRange: query.dateRange,
      entities: query.entities
    });

    return {
      documents: searchResults.documents,
      totalCount: searchResults.totalCount,
      facets: searchResults.facets
    };
  }

  async addSignature(
    documentId: string,
    signatureData: SignatureData
  ): Promise<void> {
    const signature: DocumentSignature = {
      id: uuidv4(),
      ...signatureData,
      signedAt: new Date()
    };

    await this.db.query(`
      UPDATE documents
      SET signatures = signatures || $1::jsonb,
          status = CASE
            WHEN (SELECT COUNT(*) FROM jsonb_array_elements(signatures || $1::jsonb)) >= required_signatures
            THEN 'signed'
            ELSE status
          END
      WHERE id = $2
    `, [JSON.stringify(signature), documentId]);

    await this.eventBus.publish('document.signed', { documentId, signature });
  }
}
```

### 4. Policy Engine

**Purpose**: Evaluate business rules and policies for automated decision making and compliance.

#### Policy Model

```typescript
interface Policy {
  id: string;
  projectId: string;
  name: string;
  description: string;
  domain: PolicyDomain;

  // Policy definition
  rules: PolicyRule[];
  priority: number;            // Higher number = higher priority

  // Scope
  entityTypes?: EntityType[];  // Which entities this applies to
  conditions?: string;         // When this policy applies

  // Status
  active: boolean;
  validFrom: Date;
  validUntil?: Date;

  // Inheritance
  parentPolicy?: string;
  childPolicies: string[];

  // Audit
  createdAt: Date;
  createdBy: string;
  lastEvaluatedAt?: Date;
  evaluationCount: number;
}

enum PolicyDomain {
  APPROVAL = 'approval',
  PRICING = 'pricing',
  DISCOUNT = 'discount',
  REFUND = 'refund',
  COMPLIANCE = 'compliance',
  SECURITY = 'security',
  RISK = 'risk',
  WORKFLOW = 'workflow'
}

interface PolicyRule {
  id: string;
  condition: string;           // JavaScript expression
  action: PolicyAction;
  parameters?: Record<string, any>;

  // Override capability
  override?: {
    allowedRoles: string[];
    requiresReason: boolean;
    requiresApproval: boolean;
  };
}

enum PolicyAction {
  ALLOW = 'allow',
  DENY = 'deny',
  REQUIRE_APPROVAL = 'require_approval',
  ESCALATE = 'escalate',
  LOG_WARNING = 'log_warning',
  APPLY_DISCOUNT = 'apply_discount',
  ADD_FEE = 'add_fee',
  SET_STATUS = 'set_status',
  SEND_NOTIFICATION = 'send_notification'
}

interface PolicyEvaluation {
  policyId: string;
  ruleId: string;
  context: Record<string, any>;
  result: PolicyResult;
  evaluatedAt: Date;
  evaluationTimeMs: number;
}

interface PolicyResult {
  action: PolicyAction;
  allowed: boolean;
  parameters?: Record<string, any>;
  reasoning: string;
  confidence: number;          // 0-1 confidence score

  // Human intervention
  requiresApproval: boolean;
  approvers?: string[];

  // Audit
  triggeredBy: string;         // User or system that triggered evaluation
}
```

#### Policy API

```typescript
// REST API
POST   /api/policies                    // Create policy
GET    /api/policies/:id                // Get policy
PUT    /api/policies/:id                // Update policy
DELETE /api/policies/:id                // Delete policy
GET    /api/policies                    // List policies
POST   /api/policies/evaluate           // Evaluate policy
POST   /api/policies/:id/test           // Test policy with scenarios

// Evaluation endpoint
POST   /api/policies/evaluate
{
  "domain": "approval",
  "context": {
    "action": "expense_approval",
    "amount": 5000,
    "employee": "emp-123",
    "category": "travel"
  }
}

// Response
{
  "evaluations": [
    {
      "policyId": "pol-456",
      "ruleId": "rule-789",
      "result": {
        "action": "require_approval",
        "allowed": false,
        "reasoning": "Expense amount $5000 exceeds employee limit of $2500",
        "requiresApproval": true,
        "approvers": ["manager-123", "finance-456"]
      }
    }
  ],
  "finalDecision": "require_approval",
  "reasoning": "Multiple policies require approval for this action"
}
```

#### Policy Service Implementation

```typescript
export class PolicyService {
  constructor(
    private db: Database,
    private ruleEngine: RuleEngine,
    private notificationService: NotificationService
  ) {}

  async evaluatePolicies(
    projectId: string,
    domain: PolicyDomain,
    context: Record<string, any>
  ): Promise<PolicyEvaluationResult> {
    const policies = await this.getApplicablePolicies(projectId, domain, context);
    const evaluations: PolicyEvaluation[] = [];

    for (const policy of policies) {
      const startTime = Date.now();

      for (const rule of policy.rules) {
        try {
          const result = await this.evaluateRule(rule, context);

          evaluations.push({
            policyId: policy.id,
            ruleId: rule.id,
            context,
            result,
            evaluatedAt: new Date(),
            evaluationTimeMs: Date.now() - startTime
          });

          // If rule denies or requires approval, stop evaluation
          if (!result.allowed || result.requiresApproval) {
            break;
          }
        } catch (error) {
          // Log evaluation error but continue
          console.error(`Policy evaluation error: ${error.message}`);
        }
      }
    }

    // Determine final decision
    const finalDecision = this.aggregateDecisions(evaluations);

    // Store evaluation history
    await this.storeEvaluations(evaluations);

    return {
      evaluations,
      finalDecision,
      reasoning: this.generateReasoning(evaluations, finalDecision)
    };
  }

  private async evaluateRule(
    rule: PolicyRule,
    context: Record<string, any>
  ): Promise<PolicyResult> {
    // Evaluate condition using safe JavaScript evaluation
    const conditionResult = await this.ruleEngine.evaluate(rule.condition, context);

    if (!conditionResult) {
      return {
        action: PolicyAction.ALLOW,
        allowed: true,
        reasoning: 'Rule condition not met',
        confidence: 1.0,
        requiresApproval: false
      };
    }

    // Apply action
    switch (rule.action) {
      case PolicyAction.DENY:
        return {
          action: rule.action,
          allowed: false,
          reasoning: `Rule ${rule.id} denies this action`,
          confidence: 1.0,
          requiresApproval: false
        };

      case PolicyAction.REQUIRE_APPROVAL:
        return {
          action: rule.action,
          allowed: false,
          reasoning: `Rule ${rule.id} requires approval`,
          confidence: 1.0,
          requiresApproval: true,
          approvers: rule.parameters?.approvers || []
        };

      default:
        return {
          action: rule.action,
          allowed: true,
          reasoning: `Rule ${rule.id} allows with action ${rule.action}`,
          confidence: 1.0,
          requiresApproval: false,
          parameters: rule.parameters
        };
    }
  }
}
```

### 5. Communication Hub

**Purpose**: Manage all business communications including email, SMS, notifications, and webhooks.

#### Communication Model

```typescript
interface Communication {
  id: string;
  projectId: string;
  type: CommunicationType;
  channel: CommunicationChannel;

  // Content
  template: string;            // Template ID
  subject?: string;
  content: string;
  attachments?: Attachment[];

  // Recipients
  recipients: Recipient[];

  // Context
  data: Record<string, any>;   // Template variables
  entityId?: string;           // Related entity
  runId?: string;              // NOFX run
  stepId?: string;             // NOFX step

  // Scheduling
  scheduledAt?: Date;
  timezone?: string;

  // Status
  status: CommunicationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;

  // Tracking
  opens: CommunicationEvent[];
  clicks: CommunicationEvent[];

  // Compliance
  consentRequired: boolean;
  consentObtained?: boolean;
  unsubscribable: boolean;

  // Audit
  createdAt: Date;
  createdBy: string;
}

enum CommunicationType {
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  NOTIFICATION = 'notification',
  ALERT = 'alert',
  REMINDER = 'reminder'
}

enum CommunicationChannel {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  TEAMS = 'teams'
}

enum CommunicationStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface Recipient {
  entityId?: string;           // Business entity
  email?: string;
  phone?: string;
  name?: string;
  preferences?: CommunicationPreferences;

  // Delivery tracking
  status: DeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
}

interface CommunicationTemplate {
  id: string;
  projectId: string;
  name: string;
  description: string;
  type: CommunicationType;
  channel: CommunicationChannel;

  // Template content
  subject?: string;            // For email
  htmlContent?: string;
  textContent: string;

  // Variables
  variables: TemplateVariable[];

  // Settings
  active: boolean;
  tags: string[];

  // Versioning
  version: number;
  parentVersion?: string;
}
```

#### Communication API

```typescript
// REST API
POST   /api/communications              // Send communication
GET    /api/communications/:id          // Get communication
GET    /api/communications              // List communications
POST   /api/communications/bulk         // Send bulk communications

POST   /api/templates                   // Create template
GET    /api/templates/:id               // Get template
PUT    /api/templates/:id               // Update template
GET    /api/templates                   // List templates

GET    /api/communications/:id/tracking // Get tracking data
POST   /api/webhooks/delivery           // Delivery webhook (for providers)
```

#### Communication Service Implementation

```typescript
export class CommunicationService {
  constructor(
    private db: Database,
    private emailProvider: EmailProvider,
    private smsProvider: SMSProvider,
    private templateEngine: TemplateEngine,
    private scheduler: SchedulerService
  ) {}

  async sendCommunication(
    projectId: string,
    input: SendCommunicationInput
  ): Promise<Communication> {
    const communication: Communication = {
      id: uuidv4(),
      projectId,
      ...input,
      status: CommunicationStatus.DRAFT,
      createdAt: new Date(),
      opens: [],
      clicks: []
    };

    // Render template if specified
    if (input.template) {
      const template = await this.getTemplate(input.template);
      communication.content = await this.templateEngine.render(
        template.textContent,
        input.data || {}
      );

      if (template.htmlContent) {
        communication.htmlContent = await this.templateEngine.render(
          template.htmlContent,
          input.data || {}
        );
      }
    }

    // Validate recipients
    await this.validateRecipients(communication.recipients);

    // Check compliance
    await this.checkCompliance(communication);

    // Schedule or send immediately
    if (input.scheduledAt) {
      communication.status = CommunicationStatus.SCHEDULED;
      await this.scheduler.schedule(communication.id, input.scheduledAt);
    } else {
      await this.sendNow(communication);
    }

    await this.db.query('INSERT INTO communications (...) VALUES (...)', communication);

    return communication;
  }

  private async sendNow(communication: Communication): Promise<void> {
    communication.status = CommunicationStatus.SENDING;

    const promises = communication.recipients.map(async (recipient) => {
      try {
        switch (communication.channel) {
          case CommunicationChannel.EMAIL:
            await this.emailProvider.send({
              to: recipient.email!,
              subject: communication.subject!,
              text: communication.content,
              html: communication.htmlContent,
              attachments: communication.attachments
            });
            break;

          case CommunicationChannel.SMS:
            await this.smsProvider.send({
              to: recipient.phone!,
              message: communication.content
            });
            break;

          // Other channels...
        }

        recipient.status = DeliveryStatus.SENT;
        recipient.sentAt = new Date();
      } catch (error) {
        recipient.status = DeliveryStatus.FAILED;
        recipient.failureReason = error.message;
      }
    });

    await Promise.allSettled(promises);

    communication.status = communication.recipients.every(r =>
      r.status === DeliveryStatus.SENT
    ) ? CommunicationStatus.SENT : CommunicationStatus.FAILED;

    communication.sentAt = new Date();
  }
}
```

### 6. External Integration Service

**Purpose**: Manage connections and data synchronization with external systems like banks, payment processors, and government APIs.

#### Integration Model

```typescript
interface ExternalSystem {
  id: string;
  projectId: string;
  name: string;
  type: SystemType;
  provider: string;            // Stripe, QuickBooks, etc.

  // Connection
  credentials: EncryptedCredentials;
  endpoint?: string;
  apiVersion?: string;

  // Capabilities
  capabilities: SystemCapability[];
  schema: {
    inbound: Record<string, any>;   // What we can receive
    outbound: Record<string, any>;  // What we can send
  };

  // Sync configuration
  syncConfig: SyncConfiguration;

  // Status
  status: ConnectionStatus;
  lastSyncAt?: Date;
  lastHealthCheck?: Date;

  // Settings
  settings: Record<string, any>;
  webhookUrl?: string;

  // Audit
  createdAt: Date;
  createdBy: string;
}

enum SystemType {
  PAYMENT = 'payment',
  BANK = 'bank',
  ACCOUNTING = 'accounting',
  CRM = 'crm',
  SHIPPING = 'shipping',
  TAX = 'tax',
  GOVERNMENT = 'government',
  EMAIL = 'email',
  SMS = 'sms'
}

enum SystemCapability {
  READ = 'read',
  WRITE = 'write',
  WEBHOOK = 'webhook',
  REAL_TIME = 'real_time',
  BATCH = 'batch',
  FILE_TRANSFER = 'file_transfer'
}

interface SyncConfiguration {
  mode: 'pull' | 'push' | 'bidirectional';
  frequency?: string;          // Cron expression
  batchSize?: number;
  reconciliation: 'authoritative' | 'merge' | 'flag_conflicts';

  // Data mapping
  fieldMappings: FieldMapping[];
  transformations: DataTransformation[];

  // Filters
  filters?: SyncFilter[];
}

interface ExternalOperation {
  id: string;
  systemId: string;
  operation: string;           // API operation name
  direction: 'inbound' | 'outbound';

  // Request/Response
  requestData: Record<string, any>;
  responseData?: Record<string, any>;

  // Status
  status: OperationStatus;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount: number;

  // Context
  runId?: string;
  stepId?: string;
  triggeredBy: string;
}
```

#### Integration API

```typescript
// REST API
POST   /api/external-systems            // Connect external system
GET    /api/external-systems/:id        // Get system details
PUT    /api/external-systems/:id        // Update system
DELETE /api/external-systems/:id        // Disconnect system
GET    /api/external-systems            // List connected systems

POST   /api/external-systems/:id/sync   // Trigger sync
GET    /api/external-systems/:id/status // Get sync status
POST   /api/external-systems/:id/test   // Test connection

POST   /api/external-operations          // Execute operation
GET    /api/external-operations/:id      // Get operation result
GET    /api/external-operations          // List operations

POST   /api/webhooks/external/:systemId // Webhook endpoint
```

#### Integration Service Implementation

```typescript
export class ExternalIntegrationService {
  constructor(
    private db: Database,
    private adapters: Map<string, ExternalAdapter>,
    private encryptionService: EncryptionService,
    private scheduler: SchedulerService
  ) {}

  async connectSystem(
    projectId: string,
    input: ConnectSystemInput
  ): Promise<ExternalSystem> {
    const adapter = this.adapters.get(input.provider);
    if (!adapter) {
      throw new Error(`Unsupported provider: ${input.provider}`);
    }

    // Test connection
    await adapter.testConnection(input.credentials);

    const system: ExternalSystem = {
      id: uuidv4(),
      projectId,
      ...input,
      credentials: await this.encryptionService.encrypt(input.credentials),
      status: ConnectionStatus.CONNECTED,
      createdAt: new Date()
    };

    await this.db.query('INSERT INTO external_systems (...) VALUES (...)', system);

    // Set up sync schedule if configured
    if (system.syncConfig.frequency) {
      await this.scheduler.scheduleRecurring(
        `sync-${system.id}`,
        system.syncConfig.frequency,
        () => this.syncSystem(system.id)
      );
    }

    return system;
  }

  async executeOperation(
    systemId: string,
    operation: string,
    data: Record<string, any>,
    context?: OperationContext
  ): Promise<ExternalOperation> {
    const system = await this.getSystem(systemId);
    const adapter = this.adapters.get(system.provider);

    const op: ExternalOperation = {
      id: uuidv4(),
      systemId,
      operation,
      direction: 'outbound',
      requestData: data,
      status: OperationStatus.PENDING,
      startedAt: new Date(),
      retryCount: 0,
      triggeredBy: context?.userId || 'system',
      runId: context?.runId,
      stepId: context?.stepId
    };

    try {
      op.status = OperationStatus.RUNNING;
      await this.updateOperation(op);

      const credentials = await this.encryptionService.decrypt(system.credentials);
      await adapter.connect(credentials);

      const result = await adapter.execute(operation, data);

      op.responseData = result;
      op.status = OperationStatus.COMPLETED;
      op.completedAt = new Date();

    } catch (error) {
      op.status = OperationStatus.FAILED;
      op.errorMessage = error.message;
      op.completedAt = new Date();

      // Schedule retry if appropriate
      if (this.shouldRetry(error) && op.retryCount < 3) {
        await this.scheduleRetry(op);
      }
    }

    await this.updateOperation(op);
    return op;
  }

  async syncSystem(systemId: string): Promise<SyncResult> {
    const system = await this.getSystem(systemId);
    const adapter = this.adapters.get(system.provider);

    const syncResult: SyncResult = {
      systemId,
      startedAt: new Date(),
      records: { created: 0, updated: 0, failed: 0 },
      errors: []
    };

    try {
      const credentials = await this.encryptionService.decrypt(system.credentials);
      await adapter.connect(credentials);

      switch (system.syncConfig.mode) {
        case 'pull':
          await this.pullData(adapter, system, syncResult);
          break;
        case 'push':
          await this.pushData(adapter, system, syncResult);
          break;
        case 'bidirectional':
          await this.pullData(adapter, system, syncResult);
          await this.pushData(adapter, system, syncResult);
          break;
      }

      system.lastSyncAt = new Date();
      await this.updateSystem(system);

    } catch (error) {
      syncResult.errors.push(error.message);
    }

    syncResult.completedAt = new Date();
    await this.storeSyncResult(syncResult);

    return syncResult;
  }
}
```

## Database Schema

### Core Tables

```sql
-- Projects (tenant isolation)
CREATE TABLE projects (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Entities
CREATE TABLE entities (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  attributes JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  version INTEGER DEFAULT 1
);

CREATE INDEX idx_entities_project_type ON entities(project_id, type);
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_entities_tags ON entities USING GIN(tags);
CREATE INDEX idx_entities_attributes ON entities USING GIN(attributes);

-- Entity Relationships
CREATE TABLE relationships (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
  source VARCHAR(36) NOT NULL REFERENCES entities(id),
  target VARCHAR(36) NOT NULL REFERENCES entities(id),
  type VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  strength DECIMAL(3,2),
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions (Ledger)
CREATE TABLE transactions (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
  number VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(255),
  tags TEXT[] DEFAULT '{}',
  run_id VARCHAR(36),
  step_id VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(255)
);

-- Ledger Entries
CREATE TABLE ledger_entries (
  id VARCHAR(36) PRIMARY KEY,
  transaction_id VARCHAR(36) NOT NULL REFERENCES transactions(id),
  account VARCHAR(50) NOT NULL,
  debit DECIMAL(15,2),
  credit DECIMAL(15,2),
  entity_id VARCHAR(36) REFERENCES entities(id),
  description TEXT,
  dimensions JSONB DEFAULT '{}'
);

-- Documents
CREATE TABLE documents (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  type VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  size BIGINT NOT NULL,
  hash VARCHAR(64) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  entities VARCHAR(36)[] DEFAULT '{}',
  transactions VARCHAR(36)[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft',
  extracted_text TEXT,
  extracted_data JSONB,
  signatures JSONB DEFAULT '[]',
  retention_policy VARCHAR(50),
  delete_after TIMESTAMP WITH TIME ZONE,
  legal_hold BOOLEAN DEFAULT FALSE,
  run_id VARCHAR(36),
  step_id VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Policies
CREATE TABLE policies (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  domain VARCHAR(50) NOT NULL,
  rules JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  entity_types VARCHAR(50)[] DEFAULT '{}',
  conditions TEXT,
  active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  parent_policy VARCHAR(36) REFERENCES policies(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255),
  last_evaluated_at TIMESTAMP WITH TIME ZONE,
  evaluation_count BIGINT DEFAULT 0
);
```

### Row Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant isolation
CREATE POLICY project_isolation ON projects
  FOR ALL TO business_os_app
  USING (id = current_setting('app.current_project_id')::VARCHAR);

CREATE POLICY entity_isolation ON entities
  FOR ALL TO business_os_app
  USING (project_id = current_setting('app.current_project_id')::VARCHAR);

-- Similar policies for other tables...
```

## Deployment Architecture

### Container Structure

```yaml
# docker-compose.yml
version: '3.8'
services:
  business-os:
    build: ./business-os
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/business_os
      - REDIS_URL=redis://redis:6379
      - NOFX_API_URL=http://nofx-api:3000
    depends_on:
      - postgres
      - redis
      - nofx-api

  nofx-api:
    build: ./nofx
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/nofx
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=business_os
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### Environment Configuration

```typescript
// config/environment.ts
export const config = {
  database: {
    url: process.env.DATABASE_URL!,
    pool: {
      min: 2,
      max: 10
    }
  },

  redis: {
    url: process.env.REDIS_URL!
  },

  nofx: {
    apiUrl: process.env.NOFX_API_URL!,
    apiKey: process.env.NOFX_API_KEY
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'filesystem',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION
    }
  },

  external: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY
    }
  }
};
```

## Security Considerations

### Authentication & Authorization

```typescript
// JWT-based authentication
interface AuthToken {
  userId: string;
  projectId: string;
  roles: string[];
  permissions: Permission[];
  expiresAt: Date;
}

// RBAC permissions
enum Permission {
  ENTITY_READ = 'entity:read',
  ENTITY_WRITE = 'entity:write',
  TRANSACTION_READ = 'transaction:read',
  TRANSACTION_WRITE = 'transaction:write',
  POLICY_ADMIN = 'policy:admin',
  SYSTEM_ADMIN = 'system:admin'
}
```

### Data Encryption

```typescript
// Field-level encryption for sensitive data
class EncryptionService {
  async encrypt(data: string): Promise<string> {
    // AES-256-GCM encryption
  }

  async decrypt(encryptedData: string): Promise<string> {
    // Decryption with key rotation support
  }
}
```

### Audit Logging

```typescript
// Comprehensive audit trail
interface AuditEvent {
  id: string;
  projectId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

## Performance Optimization

### Caching Strategy

```typescript
// Redis-based caching
class CacheService {
  async get(key: string): Promise<any> {
    // Get from Redis with TTL
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    // Set in Redis with expiration
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Invalidate cache keys matching pattern
  }
}

// Cache policies
const CACHE_POLICIES = {
  entities: { ttl: 300 }, // 5 minutes
  policies: { ttl: 600 }, // 10 minutes
  templates: { ttl: 3600 }, // 1 hour
  external_systems: { ttl: 1800 } // 30 minutes
};
```

### Database Optimization

```sql
-- Optimized indexes
CREATE INDEX CONCURRENTLY idx_entities_project_type_status
  ON entities(project_id, type, status);

CREATE INDEX CONCURRENTLY idx_transactions_project_date
  ON transactions(project_id, date DESC);

CREATE INDEX CONCURRENTLY idx_documents_project_category
  ON documents(project_id, category)
  WHERE archived_at IS NULL;

-- Partitioning for large tables
CREATE TABLE audit_events (
  -- partition by month
) PARTITION BY RANGE (created_at);
```

## Testing Strategy

### Unit Tests

```typescript
// Example unit test
describe('EntityService', () => {
  let service: EntityService;
  let mockDb: MockDatabase;

  beforeEach(() => {
    mockDb = new MockDatabase();
    service = new EntityService(mockDb, mockEventBus, mockSearchIndex);
  });

  it('should create entity with relationships', async () => {
    const entity = await service.createEntity('project-1', {
      type: EntityType.CUSTOMER,
      attributes: { name: 'Test Customer' }
    });

    expect(entity.id).toBeDefined();
    expect(entity.projectId).toBe('project-1');
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// Example integration test
describe('Business OS API', () => {
  let app: Application;
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = createApp(db);
  });

  it('should create and retrieve entity', async () => {
    const response = await request(app)
      .post('/api/entities')
      .send({
        type: 'customer',
        attributes: { name: 'Test Customer' }
      })
      .expect(201);

    const entityId = response.body.id;

    const getResponse = await request(app)
      .get(`/api/entities/${entityId}`)
      .expect(200);

    expect(getResponse.body.attributes.name).toBe('Test Customer');
  });
});
```

## Monitoring & Observability

### Metrics

```typescript
// Prometheus metrics
const metrics = {
  apiRequests: new Counter({
    name: 'business_os_api_requests_total',
    help: 'Total API requests',
    labelNames: ['method', 'endpoint', 'status']
  }),

  entityOperations: new Counter({
    name: 'business_os_entity_operations_total',
    help: 'Total entity operations',
    labelNames: ['operation', 'entity_type']
  }),

  policyEvaluations: new Histogram({
    name: 'business_os_policy_evaluation_duration_seconds',
    help: 'Policy evaluation duration',
    labelNames: ['domain', 'result']
  })
};
```

### Health Checks

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = await Promise.allSettled([
    db.query('SELECT 1'),
    redis.ping(),
    nofxClient.health(),
    externalSystems.healthCheck()
  ]);

  const healthy = checks.every(check => check.status === 'fulfilled');

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks: checks.map((check, i) => ({
      name: ['database', 'redis', 'nofx', 'external'][i],
      status: check.status
    }))
  });
});
```

---

This specification provides a comprehensive foundation for building the Business OS layer on top of NOFX. It maintains clean separation of concerns while providing rich business abstractions that enable sophisticated applications like the Narrative OS.