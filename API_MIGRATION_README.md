# NOFX API Vercel Migration Guide

## Overview
This project has been successfully migrated to use Vercel Functions for API endpoints. **28 endpoints** have been converted from Express to serverless functions.

## Quick Start

### Development
```bash
# Install dependencies
npm install

# Run Vercel dev server
npx vercel dev --listen 3001

# Or use npm script (if configured)
npm run vercel:dev
```

### Deployment
```bash
# Deploy to Vercel (staging)
vercel

# Deploy to production
vercel --prod
```

## Environment Variables

Set these in your Vercel dashboard or `.env.local` file:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379
JWT_SECRET=your-secret-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

## API Endpoints Reference

### 🏥 Health Check
- `GET /api/health` - System health status

### 📊 Core Run Management
- `GET /api/runs` - List all runs
- `POST /api/runs` - Create new run
- `GET /api/runs/[id]` - Get run details
- `POST /api/runs/preview` - Preview run plan
- `POST /api/runs/[id]/rerun` - Rerun existing run
- `GET /api/runs/[id]/stream` - SSE stream updates
- `GET /api/runs/[id]/timeline` - Get run timeline
- `GET /api/runs/[id]/gates` - List run gates
- `POST /api/runs/[id]/steps/[stepId]/retry` - Retry step

### 📁 Project Management
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/[id]` - Get project
- `PATCH /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project

### ⚙️ Settings & Configuration
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings

### 🤖 Model Management
- `GET /api/models` - List models
- `POST /api/models` - Add model
- `DELETE /api/models/[id]` - Delete model

### 💾 Backup System
- `GET /api/backups` - List backups
- `POST /api/backups` - Create backup
- `POST /api/backups/[id]/restore` - Restore backup

### 🚨 Responses Operations
- `GET /api/responses/ops/summary` - Operations summary
- `GET /api/responses/ops/incidents` - List incidents
- `POST /api/responses/ops/incidents/[id]/resolve` - Resolve incident
- `POST /api/responses/ops/prune` - Prune old data
- `POST /api/responses/runs/[id]/retry` - Retry response
- `POST /api/responses/runs/[id]/rollback` - Rollback changes
- `POST /api/responses/runs/[id]/export` - Export run data

### 🚪 Gates/Approval
- `POST /api/gates` - Create gate
- `POST /api/gates/[id]/approve` - Approve gate
- `POST /api/gates/[id]/waive` - Waive gate

## Authentication

Most endpoints require admin authentication. Include auth headers:

```javascript
fetch('/api/settings', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
```

## CORS Configuration

CORS headers are configured in `vercel.json`:
- Allows all origins (`*`)
- Supports all standard HTTP methods
- Accepts common headers including `X-Project-Id`

## Function Configuration

### Timeouts
- Default: 60 seconds for all functions
- SSE Stream endpoint: 60 seconds with special handling

### Runtime
- Node.js 20.x for streaming endpoints
- Default Node.js runtime for others

## Migration Notes

### From Express to Vercel

**Old Express pattern:**
```javascript
app.get('/runs', async (req, res) => {
  // handler logic
})
```

**New Vercel pattern:**
```javascript
// api/runs/index.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // handler logic
  }
}
```

### Dynamic Routes

- Express: `/runs/:id/gates`
- Vercel: `/api/runs/[id]/gates.ts`

### Multiple Methods in One File

```javascript
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // GET logic
  } else if (req.method === 'POST') {
    // POST logic
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
```

## Common Issues & Solutions

### Database Connection Errors
- Ensure `DATABASE_URL` is set in Vercel environment
- Check PostgreSQL is accessible from Vercel's network

### Authentication Failures
- Verify `JWT_SECRET` matches between environments
- Check token expiration and format

### SSE Streaming Limitations
- Vercel Functions have a 60-second max execution time
- For longer streams, consider Vercel Edge Functions or external services

### Cold Start Performance
- First request may be slower due to cold starts
- Consider using Edge Functions for frequently accessed endpoints

## Testing

### Local Testing
```bash
# Start Vercel dev server
npx vercel dev

# Test health endpoint
curl http://localhost:3000/api/health

# Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/settings
```

### Production Testing
Replace `localhost:3000` with your Vercel deployment URL.

## Monitoring

### Vercel Dashboard
- Monitor function invocations
- Check error rates
- View execution times
- Analyze cold starts

### Custom Logging
Functions log to Vercel's logging system. View logs:
```bash
vercel logs
```

## Next Steps

1. **Complete Migration**: Migrate remaining Express endpoints as needed
2. **Edge Functions**: Consider Edge Functions for global performance
3. **Database Optimization**: Implement connection pooling for serverless
4. **Rate Limiting**: Add rate limiting for public endpoints
5. **API Documentation**: Generate OpenAPI/Swagger documentation

## Support

For issues or questions:
1. Check Vercel Functions documentation
2. Review error logs in Vercel dashboard
3. Check environment variables configuration
4. Verify network connectivity for database/Redis