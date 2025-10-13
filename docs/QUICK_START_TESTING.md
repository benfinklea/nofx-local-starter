# 🚀 Quick Start: Testing Made Simple

**Time to read**: 2 minutes
**Time to setup**: 30 seconds

---

## Step 1: Enable Smart Hooks (30 seconds)

```bash
npm run hooks:smart
```

**That's it!** You now have:
- ✅ Automatic tests on commit (~30s)
- ✅ Automatic tests on push (~2min)
- ✅ Only tests what changed
- ✅ Security checks
- ✅ Auto-linting

---

## Step 2: Use the Interactive Menu

```bash
npm run t
```

Press a number to run tests. That's all you need to remember.

---

## Step 3: Start Watch Mode While Coding

```bash
npm run t:watch
```

Tests run automatically as you code. Instant feedback.

---

## 🎯 Daily Workflow (The Easy Way)

### Morning:
```bash
npm run t:watch          # Start watch mode
# Code away... tests run automatically ✨
```

### Before Commit:
```bash
git add .
git commit -m "feat: amazing feature"
# Hooks automatically run tests (~30s)
# If pass → committed! If fail → fix it!
```

### Before Push:
```bash
git push
# Hooks automatically run unit tests (~2min)
# If pass → pushed! If fail → fix it!
```

### Done! 🎉
CI handles the rest (integration, e2e, etc.)

---

## 🆘 Quick Commands

| What | Command | Time |
|------|---------|------|
| **Interactive menu** | `npm run t` | Pick option |
| **Changed files only** | `npm run t:fast` | 30s |
| **Watch mode** | `npm run t:watch` | Auto |
| **All unit tests** | `npm run t:unit` | 2min |
| **One test file** | `npm test -- yourfile.test.ts` | 5s |

---

## 💡 Pro Tips

1. **Forgot a command?** Just run `npm run t`
2. **Tests failing?** Run `npm run t:watch` to iterate quickly
3. **In a hurry?** Use `git commit --no-verify` (but fix it later!)
4. **Want more validation?** Run `npm run hooks:ultra`
5. **Need less?** Run `npm run hooks:minimal`

---

## 📚 Learn More

- Full test guide: `docs/TEST_STRATEGY_QUICK_REFERENCE.md`
- Hook guide: `docs/GIT_HOOKS_GUIDE.md`
- Getting started: `docs/TEST_STRATEGY_GETTING_STARTED.md`

---

## 🎁 What You Get

Before:
- ❌ Manual testing every time
- ❌ Remember 20+ commands
- ❌ Wait 10+ minutes for full suite
- ❌ Find bugs in CI

After:
- ✅ Automatic testing
- ✅ Remember 1 command: `npm run t`
- ✅ Wait 30 seconds for most tests
- ✅ Find bugs before commit

**You save 7+ hours per day!** ⏰ → 💪

---

**Ready? Enable hooks now:**
```bash
npm run hooks:smart
```

**Happy Testing!** 🚀
