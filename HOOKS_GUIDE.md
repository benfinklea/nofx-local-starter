# Git Hooks Performance Guide

## The Problem
Pre-commit hooks were taking 2+ minutes, running:
- Full TypeScript compilation
- ESLint on entire codebase
- All unit tests
- Secret scanning on all files

This made every commit painful! 😫

## The Solution: Configurable Hook Speeds

### 🚀 Minimal Mode (Fastest)
```bash
npm run hooks:minimal
```
- Only scans for secrets
- Commit time: ~0.1 seconds
- Use when: Rapid development, frequent commits

### ⚡ Fast Mode (Balanced) - DEFAULT
```bash
npm run hooks:fast
```
- Lints only staged files
- Quick secret scan on staged files
- TypeCheck on push only
- Commit time: ~0.2 seconds
- Use when: Daily development

### 🏰 Full Mode (Thorough)
```bash
npm run hooks:full
```
- Complete TypeScript check
- Full ESLint scan
- All unit tests
- Comprehensive secret scanning
- Commit time: 2+ minutes
- Use when: Before releases, PR reviews

### ❌ Disable Hooks (YOLO)
```bash
npm run hooks:off
```
- No checks at all
- Commit time: instant
- Use when: Emergency hotfixes (re-enable after!)

## Best Practices

1. **Daily Development**: Use `fast` mode (it's the default now)
2. **Before PR/Release**: Switch to `full` mode temporarily
   ```bash
   npm run hooks:full
   git commit -m "release: v1.0.0"
   npm run hooks:fast  # Switch back
   ```
3. **Quick Experiments**: Use `minimal` mode
4. **CI/CD**: Always runs full checks regardless of local hooks

## Bypass Options

If hooks are still blocking you:
- `git commit --no-verify` - Skip pre-commit hooks
- `git push --no-verify` - Skip pre-push hooks

## Performance Comparison

| Mode | Pre-commit | Pre-push | Total Time |
|------|------------|----------|------------|
| Full | TypeCheck + Lint + Tests + Secrets | Full test suite | 2+ minutes |
| Fast | Staged files only | TypeCheck only | ~10 seconds |
| Minimal | Quick secrets check | None | <1 second |
| Off | None | None | 0 seconds |

Remember: **Hooks are a safety net, not a barrier!** 🎯