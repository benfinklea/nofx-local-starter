# 🚀 NOFX Quick Reference Card

## ⚡ HOTKEYS (Memorize These)

```bash
npm run ?          # Show full dashboard
npm run d          # Start everything
npm run t          # Run all tests
npm run t:watch    # Tests in watch mode
npm run ship       # Deploy to production
npm run fix        # Auto-fix linting
```

## 📋 Common Workflows

### Starting Development
```bash
npm run d          # Starts API + Worker + Frontend
# Or individually:
npm run d:api      # API only
npm run d:fe       # Frontend only
npm run d:worker   # Worker only
```

### Running Tests
```bash
npm run t          # All tests
npm run t:watch    # Watch mode (for TDD)
npm run t:api      # API tests only
npm run t:e2e      # End-to-end tests
npm run t:debug    # E2E with UI debugger
```

### Before Committing
```bash
npm run fix        # Auto-fix linting issues
npm run t          # Run tests
git add .
git commit -m "feat: your changes"
```

### Deploying
```bash
npm run ship       # Full deploy (validate + push + deploy)
# OR step by step:
npm run pre-deploy # Validate first
git push           # Push to GitHub
npm run vercel:prod # Deploy to Vercel
```

### When Things Break
```bash
npm run clean      # Clean install (fixes 80% of issues)
npm run fix        # Auto-fix linting
npm run typecheck  # Check TypeScript errors
npm run env:check  # Check environment parity
npm run help       # Show all available commands
```

### Database Migrations
```bash
npm run migrate:status  # Check migration status
npm run migrate:up      # Run pending migrations
npm run migrate:create  # Create new migration
```

## 🔍 Finding Information

### Documentation
```
PREDICTIVE_ERROR_ANALYSIS.md  → Future bugs prevented
PROACTIVE_FIXES_IMPLEMENTED.md → Protection in place
STACK_SPECIFIC_ISSUES.md      → Vercel + Supabase fixes
DATABASE_POOL_FIXES.md        → Database configuration
PRE_DEPLOY_SYSTEM.md          → Deployment validation
SENTRY_SETUP.md               → Error tracking setup
```

### Dashboard
```bash
npm run ?          # Full command dashboard
npm run help       # Same as above
npm run dashboard  # Same as above
```

## 🚨 Emergency Procedures

### Production is Down
1. Check Vercel logs: https://vercel.com/dashboard
2. Check Supabase logs: https://supabase.com/dashboard
3. Rollback: Vercel Dashboard → Deployments → Previous → Promote

### Tests Failing
```bash
npm run t:api      # See which tests fail
npm run fix        # Auto-fix linting
npm run typecheck  # Check type errors
```

### Can't Deploy
```bash
npm run pre-deploy # See what's failing
npm run fix        # Fix linting issues
npm run t          # Run tests
```

### Git Hooks Blocking
```bash
npm run hooks:off  # Disable temporarily
# Make your commit
npm run hooks:full # Re-enable after
```

## 💡 Pro Tips

1. **Use watch mode** - `npm run t:watch` for instant feedback
2. **Ship command** - `npm run ship` does everything in one command
3. **Dashboard** - Type `npm run ?` whenever you forget a command
4. **Shell aliases** - Source `.shell-aliases` for even shorter commands
5. **Pre-deploy runs automatically** - Hooks prevent bad commits

## 🔗 Quick Links

- **Production:** https://nofx-control-plane.vercel.app
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub Repo:** https://github.com/your-org/nofx-local-starter

## 📞 Getting Help

1. Run `npm run ?` for full dashboard
2. Check documentation in project root (*.md files)
3. Check AI_CODER_GUIDE.md for project-specific practices

---

**Print this and keep it by your desk!** 📄
Or add to your desktop/second monitor.
