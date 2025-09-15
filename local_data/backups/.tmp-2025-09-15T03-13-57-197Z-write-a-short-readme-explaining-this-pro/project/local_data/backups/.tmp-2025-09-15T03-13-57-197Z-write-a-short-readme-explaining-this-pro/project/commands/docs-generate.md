---
name: docs-generate  
description: Auto-generate comprehensive technical documentation from code
---

## Scope Determination

Analyzing scope based on command arguments: $ARGUMENTS

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL PROJECT DOCUMENTATION**
Generating documentation for the entire codebase, all APIs, and complete architecture...
{{else}}
**Mode: RECENT CHANGES DOCUMENTATION**
Focusing on recently modified code in the current session. I will:
1. Document new or modified functions and classes
2. Update API docs for changed endpoints
3. Focus on code you've recently shown me or discussed

To generate documentation for the entire project, use: `/docs-generate --all`
{{/if}}

Generate comprehensive technical documentation by analyzing code structure, APIs, and architecture:

## Documentation Generation Strategy

### 1. Code Analysis
**Extract and Document:**
- Module/class hierarchies and relationships
- Function signatures and parameters
- Type definitions and interfaces
- Constants and configuration
- API endpoints and routes
- Database schemas and models
- Event emitters and handlers
- Error codes and exceptions

### 2. Documentation Types

### API Documentation
**Generate OpenAPI/Swagger Specification:**
```yaml
# Auto-generated API documentation
openapi: 3.0.0
info:
  title: API Documentation
  version: 1.0.0
  description: Auto-generated from code analysis
paths:
  /users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
```

### Code Documentation
**JSDoc/TSDoc Generation:**
```javascript
/**
 * @module UserService
 * @description Handles user-related business logic
 */

/**
 * Creates a new user account with validation
 * @async
 * @function createUser
 * @param {Object} userData - User information
 * @param {string} userData.email - User email address
 * @param {string} userData.password - User password (will be hashed)
 * @param {string} [userData.name] - Optional user display name
 * @returns {Promise<User>} Created user object
 * @throws {ValidationError} If email is invalid or already exists
 * @throws {DatabaseError} If database operation fails
 * @example
 * const user = await createUser({
 *   email: 'user@example.com',
 *   password: 'SecurePass123!',
 *   name: 'John Doe'
 * });
 */
```

### Architecture Documentation
**System Design Documents:**
```markdown
# System Architecture

## Overview
[Auto-generated system description based on code analysis]

## Components

### Frontend (React)
- **Technology Stack**: React 18, TypeScript, Redux
- **Build System**: Webpack 5
- **Testing**: Jest, React Testing Library
- **Key Dependencies**: [List extracted from package.json]

### Backend (Node.js)
- **Framework**: Express 4.x
- **Database**: PostgreSQL 14
- **Cache**: Redis 6.x
- **Message Queue**: RabbitMQ

## Data Flow
\`\`\`mermaid
graph LR
    Client[Client] --> LB[Load Balancer]
    LB --> API[API Server]
    API --> Cache[Redis Cache]
    API --> DB[(PostgreSQL)]
    API --> Queue[RabbitMQ]
    Queue --> Worker[Worker Service]
\`\`\`

## API Endpoints
[Table of all endpoints with methods, paths, and descriptions]

## Database Schema
[ERD diagram generated from models]

## Security
- Authentication: JWT with refresh tokens
- Authorization: Role-based access control
- Encryption: TLS 1.3, bcrypt for passwords
- Rate Limiting: 100 req/min per IP
```

### README Generation
**Comprehensive README.md:**
```markdown
# Project Name

![Build Status](https://img.shields.io/badge/build-passing-green)
![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## Description
[Auto-generated from package.json and code analysis]

## Table of Contents
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Installation
\`\`\`bash
# Clone repository
git clone [repository-url]

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Run migrations
npm run migrate

# Start development server
npm run dev
\`\`\`

## Usage
[Examples extracted from tests and code comments]

## API Documentation
See [API.md](./docs/API.md) for detailed endpoint documentation.

## Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| PORT | Server port | 3000 | No |
| DATABASE_URL | PostgreSQL connection | - | Yes |
| REDIS_URL | Redis connection | - | Yes |
| JWT_SECRET | JWT signing secret | - | Yes |

## Scripts
\`\`\`json
{
  "start": "Start production server",
  "dev": "Start development server with hot reload",
  "test": "Run test suite",
  "build": "Build for production",
  "lint": "Run ESLint",
  "migrate": "Run database migrations"
}
\`\`\`

## Project Structure
\`\`\`
src/
├── controllers/    # Request handlers
├── services/       # Business logic
├── models/         # Data models
├── routes/         # API routes
├── middleware/     # Express middleware
├── utils/          # Utility functions
├── config/         # Configuration
└── tests/          # Test files
\`\`\`

## Testing
\`\`\`bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- user.test.js

# Run in watch mode
npm run test:watch
\`\`\`

## Deployment
[Deployment instructions based on Dockerfile/configs]

## Contributing
See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License
[License extracted from package.json]
```

### Component Documentation
**React/Vue Component Docs:**
```markdown
# Component: UserProfile

## Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| userId | string | Yes | - | User ID to display |
| showEmail | boolean | No | true | Show email field |
| onEdit | function | No | - | Edit callback |

## Events
| Event | Payload | Description |
|-------|---------|-------------|
| update | User object | Fired on profile update |
| delete | User ID | Fired on profile deletion |

## Slots
| Slot | Description |
|------|-------------|
| header | Custom header content |
| footer | Custom footer content |

## Methods
| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| refresh() | - | Promise | Refresh user data |
| validate() | - | boolean | Validate form fields |

## Example
\`\`\`jsx
<UserProfile
  userId="123"
  showEmail={false}
  onEdit={handleEdit}
>
  <div slot="header">Custom Header</div>
</UserProfile>
\`\`\`
```

### Database Documentation
**Schema Documentation:**
```sql
-- Table: users
-- Description: Store user account information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL, -- User email (unique)
    password_hash VARCHAR(255) NOT NULL, -- Bcrypt hash
    name VARCHAR(100), -- Display name
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP -- Soft delete timestamp
);

-- Index for email lookups
CREATE INDEX idx_users_email ON users(email);

-- Index for soft delete queries  
CREATE INDEX idx_users_deleted ON users(deleted_at);
```

### Configuration Documentation
**Environment Variables:**
```markdown
# Configuration Documentation

## Required Environment Variables

### Database Configuration
- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://app:secret@localhost:5432/myapp`

### Redis Configuration
- `REDIS_URL`: Redis connection string
  - Format: `redis://[:password@]host[:port][/db]`
  - Example: `redis://localhost:6379/0`

### Security Configuration
- `JWT_SECRET`: Secret for JWT signing (min 32 chars)
- `JWT_EXPIRY`: Token expiration (default: 1h)
- `REFRESH_TOKEN_EXPIRY`: Refresh token expiration (default: 7d)
- `BCRYPT_ROUNDS`: Bcrypt hashing rounds (default: 10)

### Feature Flags
- `ENABLE_SIGNUP`: Allow new user registration (default: true)
- `ENABLE_2FA`: Enable two-factor authentication (default: false)
- `MAINTENANCE_MODE`: Enable maintenance mode (default: false)
```

## Documentation Generation Tools

### Automated Extraction
```javascript
class DocumentationGenerator {
  async generate() {
    const docs = {
      api: await this.extractAPIRoutes(),
      models: await this.extractModels(),
      services: await this.extractServices(),
      config: await this.extractConfiguration(),
      dependencies: await this.extractDependencies()
    };
    
    return this.formatDocumentation(docs);
  }
  
  extractAPIRoutes() {
    // Parse Express/Fastify routes
    // Extract path, method, middleware, handlers
    // Generate OpenAPI spec
  }
  
  extractModels() {
    // Parse Mongoose/Sequelize/TypeORM models
    // Extract fields, types, validations
    // Generate schema documentation
  }
  
  extractServices() {
    // Parse service classes/functions
    // Extract methods, parameters, returns
    // Generate service documentation
  }
}
```

### Documentation Templates

**Change Log:**
```markdown
# Changelog

All notable changes documented here.

## [Unreleased]
### Added
- New feature descriptions

### Changed
- Modified functionality

### Deprecated
- Features to be removed

### Removed
- Deleted features

### Fixed
- Bug fixes

### Security
- Security updates

## [1.0.0] - 2024-01-15
### Added
- Initial release
```

**Contributing Guide:**
```markdown
# Contributing

## Development Setup
1. Fork the repository
2. Create feature branch
3. Install dependencies
4. Run tests
5. Make changes
6. Submit pull request

## Code Style
- Use ESLint configuration
- Follow naming conventions
- Write tests for new features
- Update documentation

## Commit Messages
Follow conventional commits:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Testing
- chore: Maintenance
```

## Documentation Maintenance

### Keep Docs Updated
- Generate on each build
- Include in CI/CD pipeline
- Version documentation
- Track documentation coverage
- Review in code reviews

### Documentation Metrics
- Coverage percentage
- Outdated sections
- Missing examples
- Broken links
- API completeness

## Output Formats

### Multiple Formats
- Markdown for GitHub
- HTML for web hosting
- PDF for offline reading
- OpenAPI for API tools
- JSDoc for IDE support

### Hosting Options
- GitHub Pages
- Read the Docs
- Swagger UI
- Docusaurus
- GitBook

Generate comprehensive documentation now, ensuring all code is properly documented with examples and clear explanations.

## Command Completion

✅ `/docs-generate $ARGUMENTS` command complete.

Summary: Generated comprehensive technical documentation including API specs, architecture diagrams, and code examples.