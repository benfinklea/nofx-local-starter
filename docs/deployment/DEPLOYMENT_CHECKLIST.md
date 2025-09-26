# Vercel Deployment Checklist

## Pre-Deployment

### ✅ Code Preparation
- [ ] All endpoints tested locally with `npm run vercel:dev`
- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Unit tests pass (`npm test`)
- [ ] Database migrations are up to date
- [ ] All changes committed to git

### ✅ Environment Setup
- [ ] Create Vercel account and install CLI: `npm i -g vercel`
- [ ] Link project: `vercel link`
- [ ] Configure environment variables in Vercel Dashboard:
  - [ ] `DATABASE_URL`
  - [ ] `REDIS_URL`
  - [ ] `JWT_SECRET`
  - [ ] `OPENAI_API_KEY`
  - [ ] `ANTHROPIC_API_KEY`
  - [ ] `GEMINI_API_KEY`

### ✅ Database Preparation
- [ ] Production database is accessible from Vercel IPs
- [ ] Database SSL certificates configured if required
- [ ] Connection pooling configured for serverless
- [ ] Database backup created

## Deployment Steps

### 1️⃣ Initial Deployment (Staging)
```bash
# Deploy to preview/staging
npm run vercel:deploy

# Test the deployment
curl https://your-project.vercel.app/api/health
```

### 2️⃣ Testing Checklist
- [ ] Health check endpoint responds
- [ ] Authentication works correctly
- [ ] Database queries execute successfully
- [ ] Redis caching works
- [ ] File uploads work (if applicable)
- [ ] SSE streaming endpoints work (with timeout)
- [ ] CORS headers are correct

### 3️⃣ Production Deployment
```bash
# Deploy to production
npm run vercel:prod

# Verify production
curl https://your-production-domain.com/api/health
```

## Post-Deployment

### 🔍 Monitoring Setup
- [ ] Enable Vercel Analytics
- [ ] Set up error tracking (Sentry/Datadog)
- [ ] Configure uptime monitoring
- [ ] Set up alerts for errors and performance issues

### 📊 Performance Checks
- [ ] Check cold start times
- [ ] Monitor function execution times
- [ ] Review memory usage
- [ ] Check database connection pooling

### 🔒 Security Verification
- [ ] All sensitive endpoints require authentication
- [ ] Rate limiting is working
- [ ] Environment variables are not exposed
- [ ] CORS is properly configured
- [ ] SSL certificates are valid

## Rollback Plan

If issues occur:

1. **Immediate Rollback**
   ```bash
   vercel rollback
   ```

2. **Check Logs**
   ```bash
   vercel logs
   ```

3. **Debug Specific Function**
   ```bash
   vercel logs --function=api/runs/index
   ```

## Common Issues & Solutions

### Issue: Database Connection Errors
**Solution**:
- Check DATABASE_URL format
- Ensure database allows connections from Vercel IPs
- Add SSL mode if required: `?ssl=true&sslmode=require`

### Issue: Function Timeouts
**Solution**:
- Increase timeout in vercel.json (max 60s for Pro)
- Optimize database queries
- Implement caching

### Issue: Cold Start Performance
**Solution**:
- Use Edge Functions for frequently accessed endpoints
- Implement warming strategy
- Optimize bundle size

### Issue: Authentication Failures
**Solution**:
- Verify JWT_SECRET matches production
- Check token expiration settings
- Ensure cookies are configured correctly

## Optimization Recommendations

### High Priority
1. **Database Connection Pooling**: Implement PgBouncer or similar
2. **Redis Caching**: Cache frequently accessed data
3. **CDN Setup**: Use Vercel Edge Network
4. **Image Optimization**: Use Vercel Image Optimization

### Medium Priority
1. **API Rate Limiting**: Implement per-user limits
2. **Request Validation**: Add request size limits
3. **Error Boundaries**: Implement graceful error handling
4. **Monitoring**: Add custom metrics

### Low Priority
1. **API Documentation**: Generate OpenAPI specs
2. **Load Testing**: Run performance benchmarks
3. **A/B Testing**: Implement feature flags
4. **Analytics**: Track API usage patterns

## Useful Commands

```bash
# View all deployments
vercel list

# Inspect deployment
vercel inspect [deployment-url]

# View environment variables
vercel env ls

# Add environment variable
vercel env add

# Remove deployment
vercel remove [deployment-url]

# View domains
vercel domains ls

# Add custom domain
vercel domains add your-domain.com
```

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Functions Guide](https://vercel.com/docs/functions)
- [Vercel Support](https://vercel.com/support)
- Project Issues: Check GitHub Issues
- Community: Vercel Discord/Discussions