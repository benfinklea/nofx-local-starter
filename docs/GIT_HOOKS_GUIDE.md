# 🪝 Git Hooks Guide - Smart Test Automation

## TL;DR

```bash
npm run hooks:smart   # ← Use this! (RECOMMENDED)
```

This automatically runs the right tests at the right time. No thinking required.

---

## 🎯 What Are Git Hooks?

Git hooks are **automatic scripts** that run at specific times:
- **pre-commit**: Before you commit (catches issues early)
- **pre-push**: Before you push (prevents broken builds)
- **commit-msg**: Validates your commit message format

Think of them as **automatic quality checks** that save you from embarrassment! 😅

---

## 🎨 Hook Flavors (Pick Your Speed)

### 1. 🎯 SMART Hooks (RECOMMENDED)
```bash
npm run hooks:smart
```

**What it does**:
- **Pre-commit**: Runs `test:changed` (~30s) + security checks + lint
- **Pre-push**: Runs `test:unit` (~2min) + type check
- **Smart**: Only tests files you actually changed

**Use when**:
- Normal development (99% of the time)
- You want fast iteration with safety
- You trust CI to run full suite

**Time cost**:
- Commit: 30-60 seconds
- Push: 2-3 minutes

---

### 2. 💯 ULTRA Hooks (Maximum Validation)
```bash
npm run hooks:ultra
```

**What it does**:
- **Pre-commit**: Full unit + integration tests for changed files (~5min)
- **Pre-push**: EVERYTHING (unit + integration + smoke) (~10min)
- **Thorough**: Maximum confidence, minimum bugs

**Use when**:
- Working on critical features (auth, billing, security)
- Before major releases
- On release branches (main, production)

**Time cost**:
- Commit: 5-10 minutes ⏰
- Push: 10-15 minutes ⏰⏰

---

### 3. ⚡ Fast Hooks (Security Only)
```bash
npm run hooks:fast
```

**What it does**:
- **Pre-commit**: Security checks + quick lint only
- **Pre-push**: Type check + minimal tests
- **Fast**: Maximum speed, basic safety

**Use when**:
- Rapid prototyping
- Documentation changes
- You're running tests manually

**Time cost**:
- Commit: 10-20 seconds
- Push: 1-2 minutes

---

### 4. 🚀 Minimal Hooks (Almost Nothing)
```bash
npm run hooks:minimal
```

**What it does**:
- **Pre-commit**: Only checks for hardcoded secrets
- **Pre-push**: Nothing
- **Minimal**: Maximum freedom, manual testing

**Use when**:
- You know what you're doing
- Running tests separately
- Committing frequently during experimentation

**Time cost**:
- Commit: <5 seconds
- Push: Instant

---

### 5. ❌ No Hooks (Danger Zone)
```bash
npm run hooks:off
```

**What it does**:
- Nothing. You're on your own.

**Use when**:
- Never, unless you're doing git surgery
- You accept all risks

**Warning**: ⚠️ You'll probably break the build

---

## 🎬 Quick Start

### Step 1: Enable Smart Hooks
```bash
npm run hooks:smart
```

You'll see:
```
🎯 SMART hooks enabled (optimized test strategies - RECOMMENDED)
```

### Step 2: Make a Commit
```bash
git add .
git commit -m "feat: add amazing feature"
```

**What happens**:
1. Security checks run (secrets, dangerous code)
2. Linter fixes your code automatically
3. Tests for changed files run (~30s)
4. Commit message validated
5. Commit succeeds! ✅

### Step 3: Push Your Changes
```bash
git push
```

**What happens**:
1. Full unit test suite runs (~2min)
2. TypeScript type check runs
3. Push succeeds! ✅

### Step 4: That's It! 🎉

CI will handle the rest (integration, e2e, performance tests).

---

## 🔄 Switching Between Hook Modes

You can change hook modes anytime:

```bash
# Start with smart hooks (recommended)
npm run hooks:smart

# Need more validation today?
npm run hooks:ultra

# Quick doc fix?
npm run hooks:minimal

# Switch back
npm run hooks:smart
```

**Your choice persists** until you change it again.

---

## 🆘 Emergency: Bypass Hooks

### Option 1: Temporary Bypass (One Time)
```bash
git commit --no-verify -m "fix: emergency hotfix"
git push --no-verify
```

**Use when**: Production is down, tests can wait

---

### Option 2: Disable Temporarily
```bash
npm run hooks:off        # Disable hooks
# ... do your work ...
npm run hooks:smart      # Re-enable
```

---

### Option 3: Switch to Minimal
```bash
npm run hooks:minimal    # Only secret checks
# ... rapid commits ...
npm run test:all         # Run tests manually
npm run hooks:smart      # Back to normal
```

---

## 📊 Hook Comparison Table

| Feature | Minimal | Fast | Smart | Ultra |
|---------|---------|------|-------|-------|
| **Pre-commit time** | <5s | 10-20s | 30-60s | 5-10min |
| **Pre-push time** | 0s | 1-2min | 2-3min | 10-15min |
| **Secret checks** | ✅ | ✅ | ✅ | ✅ |
| **Linting** | ❌ | ✅ | ✅ | ✅ |
| **Changed tests** | ❌ | ❌ | ✅ | ✅ |
| **Unit tests** | ❌ | Partial | On push | ✅ |
| **Integration tests** | ❌ | ❌ | ❌ | ✅ |
| **Type checking** | ❌ | ✅ | ✅ | ✅ |
| **Coverage** | ❌ | ❌ | ❌ | ✅ |
| **Best for** | Experiments | Quick fixes | Daily work | Releases |

---

## 💡 Pro Tips

### 1. Start with Smart Hooks
```bash
npm run hooks:smart
```
This gives you the best balance of speed and safety.

### 2. Use Ultra Before Important Pushes
```bash
npm run hooks:ultra      # Switch to ultra
git push                 # Comprehensive validation
npm run hooks:smart      # Switch back
```

### 3. Check Current Hook Status
```bash
npm run hooks:status
```

### 4. Combine with Watch Mode
```bash
npm run t:watch          # Run in another terminal
# Hooks still run on commit/push, but you get instant feedback
```

### 5. Trust the Process
If hooks catch a bug, **they just saved you from**:
- ❌ Breaking the build
- ❌ Failing CI
- ❌ Blocking the team
- ❌ Reverting your commit

**Worth the wait!** ⏰ → 💪

---

## 🎓 Understanding Hook Behavior

### Smart Hooks: What Runs When

#### Pre-Commit (30-60s)
```bash
# If you change: src/worker/runner.ts
✅ Security checks (all files)
✅ Lint (only runner.ts)
✅ Tests related to runner.ts:
   - tests/unit/worker.runner.test.ts
   - tests/integration/run-workflow.test.ts
   (Skips unrelated tests like auth.test.ts)
```

#### Pre-Push (2-3min)
```bash
✅ All unit tests (tests/unit/**)
✅ TypeScript type checking
⏭️ Integration tests (CI handles)
⏭️ E2E tests (CI handles)
⏭️ Performance tests (CI handles)
```

---

### Ultra Hooks: What Runs When

#### Pre-Commit (5-10min)
```bash
✅ Security checks
✅ Strict linting (0 warnings allowed)
✅ Unit tests for changed files
✅ Integration tests for changed files
✅ Coverage report
✅ Type checking
```

#### Pre-Push (10-15min)
```bash
✅ Full unit test suite
✅ Full integration test suite
✅ Smoke tests
✅ Pre-deploy validation scripts
✅ Type checking
```

---

## 🔧 Advanced: Customizing Hooks

### Hook files are in the root directory:
- `.lefthook-smart.yml` - Smart hooks (recommended)
- `.lefthook-ultra.yml` - Ultra hooks
- `.lefthook-fast.yml` - Fast hooks
- `.lefthook-minimal.yml` - Minimal hooks

### To customize:
1. Edit the appropriate `.lefthook-*.yml` file
2. Re-run `npm run hooks:smart` (or whichever you use)
3. Changes take effect immediately

---

## 🐛 Troubleshooting

### Problem: Hooks are too slow
**Solution**: Switch to faster mode
```bash
npm run hooks:fast    # or hooks:minimal
```

### Problem: Tests fail in hooks but pass manually
**Solution**: Hooks might be using old cache
```bash
rm -rf .jest-cache
git commit  # Try again
```

### Problem: Hook blocks legitimate commit
**Solution**: Use `--no-verify` once, then fix
```bash
git commit --no-verify -m "wip: debugging"
# Fix the issue
git commit --amend --no-edit  # Amend without --no-verify
```

### Problem: Don't know which hooks are active
**Solution**: Check status
```bash
npm run hooks:status
cat .lefthook.yml  # See current config
```

### Problem: Hooks not running at all
**Solution**: Reinstall hooks
```bash
npm run hooks:smart
```

---

## 📚 Related Documentation

- **Test Strategy**: `docs/TEST_STRATEGY_QUICK_REFERENCE.md`
- **Getting Started**: `docs/TEST_STRATEGY_GETTING_STARTED.md`
- **Interactive Menu**: Run `npm run t`

---

## 🎯 Recommendation

**For daily development**: `npm run hooks:smart`

This gives you:
- ✅ Fast commits (30s)
- ✅ Safe pushes (2min)
- ✅ Automatic test selection
- ✅ Catches most bugs early
- ✅ CI catches the rest

**Save time. Catch bugs. Ship confidently.** 🚀

---

**Last Updated**: 2025-10-12
**Version**: 1.0
**Strategy**: Automated smart test selection
