# Narrative OS Design Document

## Overview

The Narrative OS is a revolutionary interface that allows entrepreneurs to describe their business processes as stories with characters, making complex automation accessible through natural language. This document details the design, architecture, and implementation of the narrative interface layer.

## Design Philosophy

### Core Principles

1. **Story-First Thinking**: Business processes are naturally described as sequences of events with actors
2. **Character-Based Abstraction**: Business functions become personalities that entrepreneurs can relate to
3. **Natural Language Interface**: No technical knowledge required - if you can describe it, you can automate it
4. **Progressive Disclosure**: Simple stories can become arbitrarily complex without breaking the metaphor
5. **Emotional Connection**: Characters make the system feel alive and engaging

### Design Goals

- **Zero Learning Curve**: Anyone who can write can create automation
- **Immediate Understanding**: Visual representation makes complex workflows obvious
- **Self-Documenting**: The story IS the specification and documentation
- **Collaborative**: Stories can be shared, discussed, and improved by teams
- **Extensible**: New business domains can be added as character types

## User Experience Design

### Primary User Journey

```
1. Entrepreneur opens Narrative OS
2. Describes their business process in plain English
3. System suggests characters (business functions)
4. Real-time compilation shows visual workflow
5. User refines story with character interactions
6. One-click execution starts the business process
7. Timeline shows real-time progress with narrative updates
```

### Interface Components

#### 1. Story Canvas
The main interface where users write and edit their business narratives.

```
┌─────────────────────────────────────────────────────────┐
│  📖 My Business Story                              ⚙️ 🎬  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Every morning, Sales Scout checks our CRM for new     │
│  leads. When she finds promising ones, she excitedly   │
│  tells Account Manager about them.                     │
│                                                         │
│  Account Manager is methodical - he researches each    │
│  lead thoroughly and assigns a score. If the score     │
│  is high, he schedules a call and asks Calendar        │
│  Assistant to set it up.                               │
│                                                         │
│  Calendar Assistant is very organized and always       │
│  confirms the prospect's timezone first...             │
│                                                         │
│                                    [🎯 Compile Story]  │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Rich text editor with narrative-aware autocomplete
- Real-time compilation status indicator
- Inline error highlighting with suggestions
- Character mention detection and linking
- Voice input support for natural dictation

#### 2. Character Roster
Panel showing available business functions as personalities.

```
┌─── Characters ─────────────────┐
│                                │
│ 🕵️ Sales Scout                │
│ • Finds new leads             │
│ • Tracks opportunities        │
│ • Energetic, optimistic       │
│                                │
│ 👔 Account Manager            │
│ • Qualifies prospects         │
│ • Manages relationships       │
│ • Methodical, thorough        │
│                                │
│ 📅 Calendar Assistant         │
│ • Schedules meetings          │
│ • Manages availability        │
│ • Organized, detail-oriented  │
│                                │
│ 📧 Email Specialist           │
│ • Sends communications        │
│ • Tracks responses            │
│ • Professional, timely        │
│                                │
│ [+ Add Character]              │
└────────────────────────────────┘
```

**Features**:
- Character library with search and filtering
- Personality sliders (formal ↔ casual, fast ↔ careful)
- Character creation wizard
- Drag-and-drop into story
- Character relationship visualization

#### 3. Visual Timeline
Shows the compiled workflow and real-time execution progress.

```
┌─── Timeline ───────────────────────────────────────────────┐
│                                                            │
│ 🕵️ Sales Scout checks CRM     ── 📊 Found 5 new leads    │
│        ↓                                                   │
│ 🕵️ → 👔 "Here are the leads"  ── 💬 Data transferred      │
│        ↓                                                   │
│ 👔 Account Manager researches  ── 🔍 Analyzing lead #1     │
│        ↓                                                   │
│ 👔 Scores lead (85/100)       ── ✅ High score detected    │
│        ↓                                                   │
│ 👔 → 📅 "Schedule a call"     ── 📞 Meeting request sent   │
│        ↓                                                   │
│ 📅 Calendar Assistant checks  ── ⏰ Timezone confirmed     │
│                                                            │
│ ▶️ Running... Next: Email confirmation                    │
└────────────────────────────────────────────────────────────┘
```

**Features**:
- Real-time execution visualization
- Character interaction bubbles
- Progress indicators and status
- Error highlighting and recovery options
- Timeline scrubbing (view past executions)

#### 4. Character Inspector
Detailed view of a character's configuration and personality.

```
┌─── Sales Scout ─────────────────────────────────────────┐
│                                                         │
│ 🕵️ Sales Scout                                        │
│ "I find and qualify potential customers for the team"  │
│                                                         │
│ Personality                                             │
│ Formality    [────●──] Casual                         │
│ Speed        [──────●] Fast                            │
│ Risk Tolerance [●────] Conservative                    │
│                                                         │
│ Capabilities                                            │
│ ✅ CRM Integration (Salesforce, HubSpot)              │
│ ✅ Lead Scoring                                        │
│ ✅ Email Outreach                                      │
│ ✅ Data Enrichment                                     │
│                                                         │
│ Recent Activity                                         │
│ • Found 12 leads in last 24h                          │
│ • Average lead score: 72/100                          │
│ • Response rate: 15%                                   │
│                                                         │
│ Relationships                                           │
│ Works closely with: Account Manager, Email Specialist  │
│ Reports to: Sales Director                             │
│                                                         │
│ [Edit Character] [View History]                        │
└─────────────────────────────────────────────────────────┘
```

#### 5. Story Library
Collection of story templates and previous narratives.

```
┌─── Story Library ─────────────────────────────────────────┐
│                                                           │
│ 📁 My Stories                                             │
│   📖 Daily Lead Processing (Active)                      │
│   📖 Customer Onboarding Flow                            │
│   📖 Monthly Invoicing Process                           │
│   📖 Support Ticket Handling                             │
│                                                           │
│ 📁 Templates                                              │
│   📖 E-commerce Order Processing                         │
│   📖 SaaS Customer Lifecycle                             │
│   📖 Consulting Project Workflow                         │
│   📖 Event Planning Process                              │
│                                                           │
│ 📁 Community                                              │
│   📖 Restaurant Operations (⭐ 4.8)                      │
│   📖 Real Estate Lead Nurturing (⭐ 4.6)                 │
│   📖 Agency Client Onboarding (⭐ 4.9)                   │
│                                                           │
│ [+ New Story] [Import] [Share]                           │
└───────────────────────────────────────────────────────────┘
```

## Technical Architecture

### Frontend Architecture

```
narrative-ui/
├── src/
│   ├── components/
│   │   ├── StoryCanvas/
│   │   │   ├── StoryEditor.tsx
│   │   │   ├── CompilationStatus.tsx
│   │   │   ├── ErrorHighlighter.tsx
│   │   │   └── VoiceInput.tsx
│   │   ├── CharacterRoster/
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── CharacterLibrary.tsx
│   │   │   ├── CharacterCreator.tsx
│   │   │   └── PersonalitySliders.tsx
│   │   ├── Timeline/
│   │   │   ├── TimelineView.tsx
│   │   │   ├── ExecutionProgress.tsx
│   │   │   ├── InteractionBubbles.tsx
│   │   │   └── TimelineScrubber.tsx
│   │   ├── Inspector/
│   │   │   ├── CharacterDetails.tsx
│   │   │   ├── StoryAnalytics.tsx
│   │   │   └── ConfigurationPanel.tsx
│   │   └── Library/
│   │       ├── StoryBrowser.tsx
│   │       ├── TemplateGallery.tsx
│   │       └── CommunityStories.tsx
│   ├── services/
│   │   ├── narrative/
│   │   │   ├── parser.ts
│   │   │   ├── compiler.ts
│   │   │   ├── validator.ts
│   │   │   └── executor.ts
│   │   ├── characters/
│   │   │   ├── registry.ts
│   │   │   ├── personality.ts
│   │   │   └── relationships.ts
│   │   ├── api/
│   │   │   ├── business-os.ts
│   │   │   ├── nofx.ts
│   │   │   └── websocket.ts
│   │   └── utils/
│   │       ├── nlp.ts
│   │       ├── storage.ts
│   │       └── analytics.ts
│   ├── hooks/
│   │   ├── useStoryCompilation.ts
│   │   ├── useCharacterRegistry.ts
│   │   ├── useExecutionTracking.ts
│   │   └── useVoiceInput.ts
│   ├── types/
│   │   ├── narrative.ts
│   │   ├── characters.ts
│   │   ├── timeline.ts
│   │   └── api.ts
│   └── styles/
└── public/
```

### Core Components Implementation

#### Story Parser

```typescript
// src/services/narrative/parser.ts
export class NarrativeParser {
  private nlp: NLPProcessor;
  private characterRegistry: CharacterRegistry;

  async parseStory(text: string): Promise<ParsedNarrative> {
    // Tokenize and analyze text
    const doc = await this.nlp.process(text);

    // Extract characters
    const characters = await this.extractCharacters(doc);

    // Parse temporal sequences
    const scenes = await this.extractScenes(doc, characters);

    // Identify relationships and data flows
    const interactions = await this.extractInteractions(scenes);

    // Detect conditions and branches
    const conditions = await this.extractConditions(doc);

    return {
      characters,
      scenes,
      interactions,
      conditions,
      metadata: {
        complexity: this.calculateComplexity(scenes),
        confidence: this.calculateConfidence(doc),
        suggestions: await this.generateSuggestions(doc)
      }
    };
  }

  private async extractCharacters(doc: NLPDocument): Promise<Character[]> {
    const characters: Character[] = [];

    // Find named entities that could be characters
    const entities = doc.entities.filter(e =>
      e.type === 'PERSON' || this.isBusinessRole(e.text)
    );

    for (const entity of entities) {
      // Try to match to existing character types
      const characterType = await this.matchCharacterType(entity.text);

      if (characterType) {
        // Extract personality traits from surrounding context
        const personality = await this.extractPersonality(entity, doc);

        characters.push({
          id: this.generateCharacterId(entity.text),
          name: entity.text,
          type: characterType,
          personality,
          capabilities: characterType.capabilities,
          relationships: []
        });
      }
    }

    return characters;
  }

  private async extractScenes(
    doc: NLPDocument,
    characters: Character[]
  ): Promise<Scene[]> {
    const scenes: Scene[] = [];
    const sentences = doc.sentences;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // Identify temporal markers
      const timeMarkers = this.findTimeMarkers(sentence);

      // Find character actions
      const actions = this.findCharacterActions(sentence, characters);

      // Identify data flows ("tells", "sends", "gives")
      const dataFlows = this.findDataFlows(sentence, characters);

      if (actions.length > 0 || dataFlows.length > 0) {
        scenes.push({
          id: `scene-${i}`,
          title: this.generateSceneTitle(sentence, actions),
          actions,
          dataFlows,
          timeMarkers,
          conditions: this.findConditions(sentence),
          sourceText: sentence.text,
          characters: this.getInvolvedCharacters(actions, dataFlows)
        });
      }
    }

    return scenes;
  }

  private async extractPersonality(
    entity: NLPEntity,
    doc: NLPDocument
  ): Promise<PersonalityTraits> {
    // Look for personality descriptors around the character mention
    const context = this.getContextAround(entity, doc, 50); // 50 words around

    const personalityWords = this.findPersonalityWords(context);

    return {
      formality: this.calculateFormality(personalityWords),
      speed: this.calculateSpeed(personalityWords),
      riskTolerance: this.calculateRiskTolerance(personalityWords),
      enthusiasm: this.calculateEnthusiasm(personalityWords)
    };
  }
}
```

#### Story Compiler

```typescript
// src/services/narrative/compiler.ts
export class StoryCompiler {
  private characterRegistry: CharacterRegistry;
  private businessAPI: BusinessOSAPI;

  async compileToWorkflow(narrative: ParsedNarrative): Promise<CompiledWorkflow> {
    const plan: Plan = {
      goal: this.generateGoal(narrative),
      steps: []
    };

    // Convert scenes to workflow steps
    for (const scene of narrative.scenes) {
      const steps = await this.compileScene(scene, narrative.characters);
      plan.steps.push(...steps);
    }

    // Add dependency relationships
    this.addDependencies(plan.steps, narrative.interactions);

    // Add error handling
    this.addErrorHandling(plan.steps, narrative.characters);

    // Validate workflow
    const validation = await this.validateWorkflow(plan);

    return {
      plan,
      characters: narrative.characters,
      validation,
      estimatedDuration: this.estimateDuration(plan),
      complexity: this.calculateComplexity(plan)
    };
  }

  private async compileScene(
    scene: Scene,
    characters: Character[]
  ): Promise<StepInput[]> {
    const steps: StepInput[] = [];

    // Handle character actions
    for (const action of scene.actions) {
      const character = characters.find(c => c.id === action.characterId);
      if (!character) continue;

      // Map character action to business function
      const handler = await this.characterRegistry.getHandler(character.type);

      const step: StepInput = {
        name: `${character.name}_${action.verb}`,
        tool: handler.tool,
        inputs: {
          ...action.parameters,
          _character: character.id,
          _personality: character.personality,
          _context: scene.id
        }
      };

      // Add entity references
      if (action.entities.length > 0) {
        step.entities = {
          subject: action.entities[0],
          related: action.entities.slice(1)
        };
      }

      steps.push(step);
    }

    // Handle data flows between characters
    for (const dataFlow of scene.dataFlows) {
      const step: StepInput = {
        name: `${dataFlow.from}_to_${dataFlow.to}`,
        tool: 'data_transfer',
        inputs: {
          from: dataFlow.from,
          to: dataFlow.to,
          data: dataFlow.data,
          transform: this.getPersonalityTransform(dataFlow.fromCharacter)
        }
      };

      steps.push(step);
    }

    // Handle conditions
    if (scene.conditions.length > 0) {
      const conditionalStep: StepInput = {
        name: `${scene.id}_condition`,
        tool: 'conditional',
        inputs: {
          conditions: scene.conditions,
          trueSteps: this.getConditionalSteps(scene.conditions, true),
          falseSteps: this.getConditionalSteps(scene.conditions, false)
        }
      };

      steps.push(conditionalStep);
    }

    return steps;
  }

  private getPersonalityTransform(character: Character): any {
    // Modify data based on character personality
    return {
      formality: character.personality.formality,
      urgency: character.personality.speed,
      detail_level: 1 - character.personality.speed, // Slower = more detail
      tone: character.personality.enthusiasm > 0.7 ? 'enthusiastic' : 'professional'
    };
  }
}
```

#### Character Registry

```typescript
// src/services/characters/registry.ts
export class CharacterRegistry {
  private characters: Map<string, CharacterDefinition> = new Map();

  constructor() {
    this.loadBuiltInCharacters();
  }

  private loadBuiltInCharacters() {
    // Sales characters
    this.register({
      id: 'sales_scout',
      name: 'Sales Scout',
      description: 'Finds and qualifies potential customers',
      category: 'sales',
      avatar: '🕵️',
      capabilities: [
        'lead_discovery',
        'lead_scoring',
        'crm_integration',
        'data_enrichment'
      ],
      handlerMapping: {
        'find_leads': 'crm_search',
        'score_lead': 'lead_scoring',
        'enrich_data': 'data_enrichment'
      },
      personalityDefaults: {
        formality: 0.3,
        speed: 0.8,
        riskTolerance: 0.6,
        enthusiasm: 0.9
      },
      relationships: ['account_manager', 'email_specialist']
    });

    this.register({
      id: 'account_manager',
      name: 'Account Manager',
      description: 'Manages customer relationships and deals',
      category: 'sales',
      avatar: '👔',
      capabilities: [
        'opportunity_management',
        'relationship_building',
        'deal_progression',
        'forecasting'
      ],
      handlerMapping: {
        'qualify_lead': 'lead_qualification',
        'schedule_meeting': 'calendar_booking',
        'update_opportunity': 'crm_update'
      },
      personalityDefaults: {
        formality: 0.7,
        speed: 0.4,
        riskTolerance: 0.3,
        enthusiasm: 0.6
      },
      relationships: ['sales_scout', 'calendar_assistant']
    });

    // Operations characters
    this.register({
      id: 'calendar_assistant',
      name: 'Calendar Assistant',
      description: 'Manages schedules and meeting coordination',
      category: 'operations',
      avatar: '📅',
      capabilities: [
        'meeting_scheduling',
        'availability_checking',
        'timezone_handling',
        'reminder_sending'
      ],
      handlerMapping: {
        'schedule_meeting': 'calendar_booking',
        'check_availability': 'calendar_check',
        'send_reminder': 'email_send'
      },
      personalityDefaults: {
        formality: 0.8,
        speed: 0.9,
        riskTolerance: 0.1,
        enthusiasm: 0.5
      }
    });

    // Communication characters
    this.register({
      id: 'email_specialist',
      name: 'Email Specialist',
      description: 'Handles all email communications',
      category: 'communication',
      avatar: '📧',
      capabilities: [
        'email_composition',
        'template_management',
        'delivery_tracking',
        'response_handling'
      ],
      handlerMapping: {
        'send_email': 'email_send',
        'track_response': 'email_tracking',
        'follow_up': 'email_followup'
      },
      personalityDefaults: {
        formality: 0.6,
        speed: 0.7,
        riskTolerance: 0.2,
        enthusiasm: 0.4
      }
    });

    // Add more character types...
  }

  async createCustomCharacter(
    definition: CreateCharacterInput
  ): Promise<CharacterDefinition> {
    const character: CharacterDefinition = {
      id: this.generateId(definition.name),
      ...definition,
      custom: true,
      createdAt: new Date()
    };

    this.register(character);
    return character;
  }

  getCharacterSuggestions(context: string): CharacterSuggestion[] {
    // Analyze context and suggest relevant characters
    const suggestions: CharacterSuggestion[] = [];

    for (const [id, character] of this.characters) {
      const relevance = this.calculateRelevance(character, context);
      if (relevance > 0.3) {
        suggestions.push({
          character,
          relevance,
          reasoning: this.generateReasoningForSuggestion(character, context)
        });
      }
    }

    return suggestions.sort((a, b) => b.relevance - a.relevance);
  }
}
```

#### Real-time Execution Tracking

```typescript
// src/hooks/useExecutionTracking.ts
export function useExecutionTracking(runId: string) {
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [status, setStatus] = useState<ExecutionStatus>('idle');

  useEffect(() => {
    if (!runId) return;

    // Connect to SSE stream for real-time updates
    const eventSource = new EventSource(`/api/runs/${runId}/stream`);

    eventSource.addEventListener('init', (event) => {
      const initialEvents = JSON.parse(event.data);
      setEvents(initialEvents.map(transformToNarrativeEvent));
    });

    eventSource.addEventListener('append', (event) => {
      const newEvents = JSON.parse(event.data);
      setEvents(prev => [
        ...prev,
        ...newEvents.map(transformToNarrativeEvent)
      ]);
    });

    return () => eventSource.close();
  }, [runId]);

  const transformToNarrativeEvent = (event: NOFXEvent): ExecutionEvent => {
    // Transform technical NOFX events into narrative-friendly format
    const character = getCharacterFromStep(event.stepId);

    return {
      id: event.id,
      timestamp: event.timestamp,
      character: character?.name || 'System',
      avatar: character?.avatar || '⚙️',
      action: generateNarrativeAction(event),
      status: event.type.includes('failed') ? 'error' : 'success',
      details: event.payload,
      duration: event.duration
    };
  };

  const generateNarrativeAction = (event: NOFXEvent): string => {
    // Convert technical events to narrative descriptions
    switch (event.type) {
      case 'step.started':
        return `started ${getActionFromStep(event.stepId)}`;
      case 'step.completed':
        return `successfully ${getActionFromStep(event.stepId)}`;
      case 'step.failed':
        return `encountered an issue while ${getActionFromStep(event.stepId)}`;
      default:
        return event.type;
    }
  };

  return {
    events,
    status,
    isRunning: status === 'running',
    progress: calculateProgress(events),
    currentAction: getCurrentAction(events)
  };
}
```

## Natural Language Processing

### NLP Pipeline

```typescript
// src/services/utils/nlp.ts
export class NLPProcessor {
  private pipeline: Pipeline;

  constructor() {
    this.pipeline = new Pipeline([
      new Tokenizer(),
      new SentenceSplitter(),
      new POSTagger(),
      new NamedEntityRecognizer(),
      new DependencyParser(),
      new BusinessTermRecognizer(), // Custom for business contexts
      new TemporalRecognizer(),     // Custom for time expressions
      new ActionRecognizer()        // Custom for action identification
    ]);
  }

  async process(text: string): Promise<NLPDocument> {
    return this.pipeline.process(text);
  }
}

class BusinessTermRecognizer {
  private businessTerms = new Map([
    // Sales terms
    ['lead', { type: 'business_entity', category: 'sales' }],
    ['prospect', { type: 'business_entity', category: 'sales' }],
    ['customer', { type: 'business_entity', category: 'sales' }],
    ['opportunity', { type: 'business_entity', category: 'sales' }],

    // Financial terms
    ['invoice', { type: 'business_entity', category: 'finance' }],
    ['payment', { type: 'business_entity', category: 'finance' }],
    ['transaction', { type: 'business_entity', category: 'finance' }],

    // Operations terms
    ['order', { type: 'business_entity', category: 'operations' }],
    ['shipment', { type: 'business_entity', category: 'operations' }],
    ['inventory', { type: 'business_entity', category: 'operations' }]
  ]);

  recognize(tokens: Token[]): BusinessEntity[] {
    const entities: BusinessEntity[] = [];

    for (const token of tokens) {
      const term = this.businessTerms.get(token.text.toLowerCase());
      if (term) {
        entities.push({
          text: token.text,
          start: token.start,
          end: token.end,
          type: term.type,
          category: term.category
        });
      }
    }

    return entities;
  }
}
```

### Template System

```typescript
// src/services/narrative/templates.ts
export class NarrativeTemplateEngine {
  private templates: Map<string, NarrativeTemplate> = new Map();

  constructor() {
    this.loadBusinessTemplates();
  }

  private loadBusinessTemplates() {
    // E-commerce order processing
    this.register({
      id: 'ecommerce_order',
      title: 'E-commerce Order Processing',
      description: 'Complete order fulfillment workflow',
      category: 'ecommerce',
      template: `
        When a customer places an order, Order Processor immediately validates the payment with Payment Specialist.

        If payment is confirmed, Inventory Manager checks if all items are available. If everything is in stock,
        she reserves the items and notifies Fulfillment Coordinator.

        Fulfillment Coordinator is very organized - he creates a picking list and assigns it to the warehouse team.
        Once items are picked and packed, Shipping Manager chooses the best carrier and creates shipping labels.

        Finally, Customer Service Representative sends a confirmation email with tracking information to the customer.
      `,
      characters: [
        'order_processor',
        'payment_specialist',
        'inventory_manager',
        'fulfillment_coordinator',
        'shipping_manager',
        'customer_service_rep'
      ],
      variables: [
        { name: 'order_threshold', type: 'number', default: 100 },
        { name: 'shipping_methods', type: 'array', default: ['standard', 'express'] }
      ]
    });

    // SaaS customer onboarding
    this.register({
      id: 'saas_onboarding',
      title: 'SaaS Customer Onboarding',
      description: 'Welcome new subscribers and get them started',
      category: 'saas',
      template: `
        When someone signs up for our service, Welcome Specialist immediately sends a personalized welcome email
        with their login credentials and next steps.

        Onboarding Coordinator is friendly and helpful - she schedules a welcome call within 24 hours and sets up
        their account with default settings. She also enrolls them in our email course.

        Training Specialist monitors their progress for the first week. If they haven't completed the basic setup,
        he reaches out with helpful tips and offers a quick training session.

        Success Manager takes over after the first week to ensure long-term success and satisfaction.
      `,
      characters: [
        'welcome_specialist',
        'onboarding_coordinator',
        'training_specialist',
        'success_manager'
      ]
    });
  }

  async instantiateTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let instantiated = template.template;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      instantiated = instantiated.replace(regex, String(value));
    }

    return instantiated;
  }
}
```

## Voice Interface

### Speech Recognition Integration

```typescript
// src/services/voice/speechRecognition.ts
export class VoiceNarrativeService {
  private recognition: SpeechRecognition;
  private isListening = false;

  constructor() {
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.setupRecognition();
  }

  private setupRecognition() {
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      this.onTranscript?.({
        final: finalTranscript,
        interim: interimTranscript,
        confidence: event.results[event.resultIndex][0].confidence
      });
    };

    this.recognition.onerror = (event) => {
      this.onError?.(event.error);
    };
  }

  startListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isListening) {
        resolve();
        return;
      }

      this.recognition.start();
      this.isListening = true;

      this.recognition.onstart = () => resolve();
      this.recognition.onerror = (event) => {
        this.isListening = false;
        reject(new Error(event.error));
      };
    });
  }

  stopListening() {
    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  // Voice command processing
  private processVoiceCommand(transcript: string): VoiceCommand | null {
    const normalizedText = transcript.toLowerCase().trim();

    // Navigation commands
    if (normalizedText.includes('show characters')) {
      return { type: 'navigation', action: 'show_characters' };
    }

    if (normalizedText.includes('run story') || normalizedText.includes('execute')) {
      return { type: 'execution', action: 'run_story' };
    }

    // Editing commands
    if (normalizedText.startsWith('add character')) {
      const characterName = this.extractCharacterName(normalizedText);
      return {
        type: 'editing',
        action: 'add_character',
        parameters: { name: characterName }
      };
    }

    // Story dictation
    return {
      type: 'dictation',
      action: 'append_text',
      parameters: { text: transcript }
    };
  }
}
```

## Accessibility & Internationalization

### Accessibility Features

```typescript
// src/components/accessibility/AccessibilityProvider.tsx
export const AccessibilityProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>({
    highContrast: false,
    reducedMotion: false,
    largeText: false,
    screenReader: false,
    keyboardNavigation: true
  });

  useEffect(() => {
    // Detect system preferences
    const mediaQueries = {
      highContrast: window.matchMedia('(prefers-contrast: high)'),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      largeText: window.matchMedia('(prefers-font-size: large)')
    };

    for (const [key, query] of Object.entries(mediaQueries)) {
      setPreferences(prev => ({ ...prev, [key]: query.matches }));

      query.addEventListener('change', (e) => {
        setPreferences(prev => ({ ...prev, [key]: e.matches }));
      });
    }
  }, []);

  return (
    <AccessibilityContext.Provider value={{preferences, setPreferences}}>
      <div className={getAccessibilityClasses(preferences)}>
        {children}
      </div>
    </AccessibilityContext.Provider>
  );
};

// Keyboard navigation for story canvas
export const useKeyboardNavigation = () => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + C: Focus character roster
      if (event.altKey && event.key === 'c') {
        document.getElementById('character-roster')?.focus();
        event.preventDefault();
      }

      // Alt + S: Focus story editor
      if (event.altKey && event.key === 's') {
        document.getElementById('story-editor')?.focus();
        event.preventDefault();
      }

      // Alt + T: Focus timeline
      if (event.altKey && event.key === 't') {
        document.getElementById('timeline')?.focus();
        event.preventDefault();
      }

      // Ctrl + Enter: Compile and run story
      if (event.ctrlKey && event.key === 'Enter') {
        document.getElementById('run-story-btn')?.click();
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
};
```

### Screen Reader Support

```typescript
// src/components/accessibility/ScreenReaderSupport.tsx
export const ScreenReaderAnnouncer: React.FC = () => {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const announce = useCallback((message: string) => {
    setAnnouncements(prev => [...prev, message]);

    // Clear announcement after screen reader has time to read it
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 1000);
  }, []);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      role="status"
    >
      {announcements.map((announcement, index) => (
        <span key={index}>{announcement}</span>
      ))}
    </div>
  );
};

// Usage in timeline component
const announceStepCompletion = (character: Character, action: string) => {
  announce(`${character.name} has completed ${action}`);
};
```

### Internationalization

```typescript
// src/i18n/narrativeLocalization.ts
export const narrativeTranslations = {
  en: {
    characters: {
      sales_scout: 'Sales Scout',
      account_manager: 'Account Manager',
      // ... other characters
    },
    actions: {
      finds_leads: 'finds new leads',
      scores_lead: 'evaluates the lead',
      schedules_meeting: 'schedules a meeting',
      // ... other actions
    },
    templates: {
      every_morning: 'Every morning',
      when_customer: 'When a customer',
      if_payment_confirmed: 'If payment is confirmed',
      // ... other templates
    }
  },
  es: {
    characters: {
      sales_scout: 'Explorador de Ventas',
      account_manager: 'Gerente de Cuentas',
      // ... otros personajes
    },
    actions: {
      finds_leads: 'encuentra nuevos prospectos',
      scores_lead: 'evalúa el prospecto',
      schedules_meeting: 'programa una reunión',
      // ... otras acciones
    }
  },
  // Add more languages...
};

// Character personality localization
export const personalityLocalization = {
  en: {
    formality: {
      low: 'casual and friendly',
      high: 'formal and professional'
    },
    speed: {
      low: 'deliberate and thorough',
      high: 'quick and efficient'
    }
  },
  es: {
    formality: {
      low: 'casual y amigable',
      high: 'formal y profesional'
    },
    speed: {
      low: 'deliberado y minucioso',
      high: 'rápido y eficiente'
    }
  }
};
```

## Performance Optimization

### Lazy Loading and Code Splitting

```typescript
// src/components/LazyComponents.tsx
export const LazyStoryCanvas = lazy(() => import('./StoryCanvas/StoryCanvas'));
export const LazyTimeline = lazy(() => import('./Timeline/TimelineView'));
export const LazyCharacterInspector = lazy(() => import('./Inspector/CharacterDetails'));

// Route-based code splitting
const NarrativeRoutes = () => (
  <Routes>
    <Route path="/" element={
      <Suspense fallback={<StoryLoadingSkeleton />}>
        <LazyStoryCanvas />
      </Suspense>
    } />
    <Route path="/timeline/:runId" element={
      <Suspense fallback={<TimelineLoadingSkeleton />}>
        <LazyTimeline />
      </Suspense>
    } />
  </Routes>
);
```

### Caching Strategy

```typescript
// src/services/cache/narrativeCache.ts
export class NarrativeCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  // Cache parsed narratives to avoid re-parsing
  cacheParseResult(text: string, result: ParsedNarrative) {
    const key = this.hashText(text);
    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      hits: 0
    });
  }

  getCachedParseResult(text: string): ParsedNarrative | null {
    const key = this.hashText(text);
    const entry = this.cache.get(key);

    if (!entry || Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  // Cache character suggestions
  cacheCharacterSuggestions(context: string, suggestions: CharacterSuggestion[]) {
    const key = `suggestions:${this.hashText(context)}`;
    this.cache.set(key, {
      data: suggestions,
      timestamp: Date.now(),
      hits: 0
    });
  }

  private hashText(text: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}
```

### Virtual Scrolling for Large Timelines

```typescript
// src/components/Timeline/VirtualTimeline.tsx
export const VirtualTimeline: React.FC<{events: ExecutionEvent[]}> = ({events}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({start: 0, end: 50});

  const itemHeight = 80; // Height of each timeline item
  const overscan = 10; // Render extra items for smooth scrolling

  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const containerHeight = target.clientHeight;

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      events.length,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    setVisibleRange({start, end});
  }, [events.length, itemHeight, overscan]);

  const visibleEvents = events.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      className="timeline-container"
      style={{height: '100%', overflow: 'auto'}}
      onScroll={handleScroll}
    >
      <div style={{height: events.length * itemHeight, position: 'relative'}}>
        <div
          style={{
            transform: `translateY(${visibleRange.start * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleEvents.map((event, index) => (
            <TimelineItem
              key={event.id}
              event={event}
              style={{height: itemHeight}}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

## Testing Strategy

### Component Testing

```typescript
// src/components/__tests__/StoryCanvas.test.tsx
describe('StoryCanvas', () => {
  let mockNarrativeAPI: jest.Mocked<NarrativeAPI>;

  beforeEach(() => {
    mockNarrativeAPI = {
      parseStory: jest.fn(),
      compileStory: jest.fn(),
      executeStory: jest.fn()
    };
  });

  it('should parse story on text change', async () => {
    const { getByRole } = render(
      <StoryCanvas narrativeAPI={mockNarrativeAPI} />
    );

    const editor = getByRole('textbox');

    await userEvent.type(editor, 'Sales Scout finds new leads');

    await waitFor(() => {
      expect(mockNarrativeAPI.parseStory).toHaveBeenCalledWith('Sales Scout finds new leads');
    });
  });

  it('should display character suggestions', async () => {
    mockNarrativeAPI.parseStory.mockResolvedValue({
      characters: [
        { id: 'sales_scout', name: 'Sales Scout', type: 'sales_scout' }
      ],
      scenes: [],
      interactions: [],
      conditions: []
    });

    const { getByRole, getByText } = render(
      <StoryCanvas narrativeAPI={mockNarrativeAPI} />
    );

    const editor = getByRole('textbox');
    await userEvent.type(editor, 'Sales Scout finds leads');

    await waitFor(() => {
      expect(getByText('Sales Scout')).toBeInTheDocument();
    });
  });
});
```

### Integration Testing

```typescript
// src/__tests__/integration/narrativeFlow.test.tsx
describe('Narrative Flow Integration', () => {
  it('should complete full story creation and execution flow', async () => {
    const { getByRole, getByText } = render(<NarrativeApp />);

    // 1. Write story
    const editor = getByRole('textbox');
    await userEvent.type(editor, `
      Every morning, Sales Scout checks the CRM for new leads.
      When she finds them, she tells Account Manager about the promising ones.
    `);

    // 2. Verify character detection
    await waitFor(() => {
      expect(getByText('Sales Scout')).toBeInTheDocument();
      expect(getByText('Account Manager')).toBeInTheDocument();
    });

    // 3. Compile story
    const compileButton = getByText('Compile Story');
    await userEvent.click(compileButton);

    // 4. Verify workflow generation
    await waitFor(() => {
      expect(getByText('Workflow compiled successfully')).toBeInTheDocument();
    });

    // 5. Execute story
    const runButton = getByText('Run Story');
    await userEvent.click(runButton);

    // 6. Verify timeline updates
    await waitFor(() => {
      expect(getByText('Sales Scout started checking CRM')).toBeInTheDocument();
    });
  });
});
```

### End-to-End Testing

```typescript
// e2e/narrative.spec.ts
import { test, expect } from '@playwright/test';

test('entrepreneur can create and run business story', async ({ page }) => {
  await page.goto('/narrative');

  // Write a business story
  await page.fill('[data-testid=story-editor]', `
    When a customer places an order, Order Processor validates the payment.
    If payment is approved, Inventory Manager checks stock levels.
    When items are available, Fulfillment Team prepares the shipment.
  `);

  // Verify real-time compilation
  await expect(page.locator('[data-testid=character-roster]')).toContainText('Order Processor');
  await expect(page.locator('[data-testid=character-roster]')).toContainText('Inventory Manager');
  await expect(page.locator('[data-testid=character-roster]')).toContainText('Fulfillment Team');

  // Compile the story
  await page.click('[data-testid=compile-button]');
  await expect(page.locator('[data-testid=compilation-status]')).toContainText('Success');

  // Run the story
  await page.click('[data-testid=run-button]');

  // Verify timeline shows execution
  await expect(page.locator('[data-testid=timeline]')).toContainText('Order Processor started');

  // Wait for completion
  await page.waitForSelector('[data-testid=execution-complete]');
  await expect(page.locator('[data-testid=execution-status]')).toContainText('Completed');
});
```

## Analytics & Monitoring

### User Analytics

```typescript
// src/services/analytics/narrativeAnalytics.ts
export class NarrativeAnalytics {
  track(event: AnalyticsEvent) {
    // Track user interactions with narrative interface
    const payload = {
      event: event.type,
      properties: {
        ...event.properties,
        timestamp: Date.now(),
        sessionId: this.getSessionId(),
        userId: this.getUserId()
      }
    };

    this.send(payload);
  }

  trackStoryCreation(story: ParsedNarrative) {
    this.track({
      type: 'story_created',
      properties: {
        characters_count: story.characters.length,
        scenes_count: story.scenes.length,
        complexity: story.metadata.complexity,
        story_length: story.sourceText.length
      }
    });
  }

  trackCharacterUsage(character: Character, action: string) {
    this.track({
      type: 'character_used',
      properties: {
        character_type: character.type,
        character_name: character.name,
        action,
        personality_formality: character.personality.formality,
        personality_speed: character.personality.speed
      }
    });
  }

  trackExecutionMetrics(execution: ExecutionResult) {
    this.track({
      type: 'story_executed',
      properties: {
        duration_ms: execution.durationMs,
        steps_count: execution.stepsCount,
        success_rate: execution.successRate,
        errors_count: execution.errorsCount
      }
    });
  }
}
```

### Performance Monitoring

```typescript
// src/services/monitoring/performanceMonitor.ts
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>();

  startMeasurement(name: string): string {
    const measurementId = `${name}-${Date.now()}`;

    this.metrics.set(measurementId, {
      name,
      startTime: performance.now(),
      endTime: null,
      duration: null
    });

    return measurementId;
  }

  endMeasurement(measurementId: string) {
    const metric = this.metrics.get(measurementId);
    if (!metric) return;

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    // Report to monitoring service
    this.reportMetric(metric);

    // Clean up
    this.metrics.delete(measurementId);
  }

  measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const measurementId = this.startMeasurement(name);

    return fn().finally(() => {
      this.endMeasurement(measurementId);
    });
  }

  private reportMetric(metric: PerformanceMetric) {
    // Send to analytics
    console.log(`Performance: ${metric.name} took ${metric.duration}ms`);

    // Alert if performance is degraded
    if (metric.duration! > this.getThreshold(metric.name)) {
      this.alertSlowPerformance(metric);
    }
  }
}

// Usage in components
const parseStoryWithMetrics = async (text: string) => {
  return performanceMonitor.measureAsync('story_parsing', async () => {
    return narrativeParser.parseStory(text);
  });
};
```

## Error Handling & Recovery

### Error Boundary for Narrative Components

```typescript
// src/components/ErrorBoundary/NarrativeErrorBoundary.tsx
export class NarrativeErrorBoundary extends React.Component<
  NarrativeErrorBoundaryProps,
  NarrativeErrorBoundaryState
> {
  constructor(props: NarrativeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<NarrativeErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: React.ErrorInfo) {
    // Send to error tracking service
    console.error('Narrative Error:', error, errorInfo);

    // Include narrative context if available
    const narrativeContext = this.getNarrativeContext();
    if (narrativeContext) {
      console.error('Narrative Context:', narrativeContext);
    }
  }

  private getNarrativeContext() {
    // Extract current story state for debugging
    return {
      currentStory: localStorage.getItem('current_story'),
      characters: localStorage.getItem('characters'),
      executionState: localStorage.getItem('execution_state')
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <NarrativeErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          onReportIssue={() => this.reportIssue()}
        />
      );
    }

    return this.props.children;
  }
}

const NarrativeErrorFallback: React.FC<{
  error: Error | null;
  onRetry: () => void;
  onReportIssue: () => void;
}> = ({ error, onRetry, onReportIssue }) => (
  <div className="error-fallback">
    <h2>Something went wrong with your story</h2>
    <p>Don't worry - your work is saved. Here's what happened:</p>
    <details>
      <summary>Error details</summary>
      <pre>{error?.message}</pre>
    </details>

    <div className="error-actions">
      <button onClick={onRetry}>Try Again</button>
      <button onClick={onReportIssue}>Report Issue</button>
    </div>
  </div>
);
```

## Security Considerations

### Content Security and Sanitization

```typescript
// src/services/security/contentSecurity.ts
export class ContentSecurityService {
  sanitizeNarrative(text: string): string {
    // Remove potentially harmful content while preserving narrative structure
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: [], // Only allow plain text
      ALLOWED_ATTR: [],
      STRIP_COMMENTS: true
    });
  }

  validateCharacterInput(character: CreateCharacterInput): ValidationResult {
    const errors: string[] = [];

    // Validate character name
    if (!this.isValidCharacterName(character.name)) {
      errors.push('Character name contains invalid characters');
    }

    // Validate capabilities
    if (!this.areValidCapabilities(character.capabilities)) {
      errors.push('Invalid character capabilities specified');
    }

    // Check for script injection attempts
    if (this.containsSuspiciousContent(character)) {
      errors.push('Character definition contains potentially unsafe content');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private containsSuspiciousContent(input: any): boolean {
    const suspicious = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /function\s*\(/i
    ];

    const jsonString = JSON.stringify(input);
    return suspicious.some(pattern => pattern.test(jsonString));
  }
}
```

## Deployment and DevOps

### Build and Deployment Pipeline

```yaml
# .github/workflows/narrative-ui.yml
name: Build and Deploy Narrative UI

on:
  push:
    branches: [main]
    paths: ['apps/narrative-ui/**']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: apps/narrative-ui

      - name: Run tests
        run: npm test -- --coverage
        working-directory: apps/narrative-ui

      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: apps/narrative-ui

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: apps/narrative-ui

      - name: Build application
        run: npm run build
        working-directory: apps/narrative-ui
        env:
          REACT_APP_API_URL: ${{ secrets.API_URL }}
          REACT_APP_WS_URL: ${{ secrets.WS_URL }}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: narrative-ui-build
          path: apps/narrative-ui/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to CDN
        run: |
          # Deploy to Cloudflare, Vercel, or similar
          echo "Deploying Narrative UI..."
```

## Conclusion

The Narrative OS represents a paradigm shift in business automation interfaces. By leveraging natural language storytelling and character-based abstractions, we can make sophisticated workflow automation accessible to entrepreneurs without technical backgrounds.

The design emphasizes:

1. **Intuitive Interaction**: Stories are natural for humans
2. **Progressive Complexity**: Simple stories can become arbitrarily sophisticated
3. **Emotional Engagement**: Characters create connection and understanding
4. **Self-Documentation**: The story IS the specification
5. **Collaborative Development**: Stories can be shared and improved by teams

This design document provides the foundation for building a revolutionary interface that transforms how businesses think about and implement automation. The combination of natural language processing, character-based abstraction, and real-time visualization creates an experience that is both powerful and approachable.

---

*This design represents the next evolution in business automation interfaces - making the complex simple while preserving the full power of the underlying platform.*