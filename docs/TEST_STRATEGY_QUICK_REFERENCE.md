# 🧪 Test Strategy Quick Reference

**TL;DR**: Just run `npm run t` to see an interactive menu! No need to remember anything.

---

## ⚡ Super Quick Commands (Muscle Memory)

```bash
npm run t          # Interactive menu - pick what you need
npm run t:fast     # Changed files only (~30s)
npm run t:unit     # All unit tests (~2min)
npm run t:watch    # Watch mode for changed files
npm run t:int      # Integration tests (~3min)
```

---

## 🎯 When Should I Run Tests?

### 💻 While Coding
```bash
npm run t:watch    # Runs automatically on save
```
**Why**: Instant feedback, catches bugs immediately

---

### 📝 Before Every Commit
```bash
npm run t:fast     # Only tests what you changed
```
**Why**: Fast validation (~30s), catches regressions

---

### 🚀 Before Pushing
```bash
npm run t:unit     # Full unit test suite
```
**Why**: Comprehensive check (~2min), prevents broken builds

---

### 🎁 Before Creating PR
```bash
npm run t:int      # Integration tests
```
**Why**: Tests real interactions (~3min), validates system works

---

### 🏗️ Let CI Handle
```bash
# CI runs automatically:
# - Full test suite
# - E2E tests
# - Performance tests
# - Security scans
```
**Why**: Slow tests (~20min), you don't wait for them

---

## 🤔 "I Just Want To..."

### → Test one specific file
```bash
npm test -- worker.runner.test.ts
```

### → Test one module (e.g., auth)
```bash
npm test -- tests/unit/auth
```

### → See what tests would run (without running)
```bash
npm test -- --listTests --onlyChanged
```

### → Run tests and see coverage
```bash
npm run test:coverage
```

### → Debug a failing test
```bash
npm run t:debug    # For Playwright tests
node --inspect-brk node_modules/.bin/jest --runInBand your.test.ts  # For Jest
```

---

## 📊 Test Tiers Explained (Simple Version)

| Emoji | Name | Speed | When | Command |
|-------|------|-------|------|---------|
| ⚡ | Lightning | <30s | While coding | `t:fast` |
| 🚀 | Fast | 1-2min | Before commit | `t:unit` |
| 🔷 | Medium | 2-5min | Before push | `t:int` |
| 🐢 | Slow | 10-20min | CI only | Let CI run |

---

## 💡 Pro Tips

### Use the Interactive Menu
```bash
npm run t
```
- Shows smart suggestions based on your git status
- Organized by speed tier
- Built-in workflow guide (press `?`)
- No need to remember commands!

### Watch Mode is Your Friend
```bash
npm run t:watch
```
- Auto-runs tests as you code
- Only runs affected tests
- Near-instant feedback

### Changed Files Testing Saves Hours
```bash
npm run t:fast
```
- Run this 50 times/day: 50 × 30s = **25 minutes**
- vs full suite 50 times: 50 × 10min = **8+ hours**
- You save **7+ hours per day**! 🎉

---

## 🆘 Troubleshooting

### Tests are slow
✅ Use `npm run t:fast` instead of `npm test`
✅ Use `npm run t:watch` during development
✅ Only run full suite before push/on CI

### "I changed one file but many tests run"
✅ That's normal! Tests that **import** your file also run
✅ This is good - catches unexpected breakage
✅ Still faster than running everything

### Tests keep failing in watch mode
✅ Press `a` to run all tests once
✅ Press `o` to only run changed tests
✅ Press `p` to filter by filename pattern

### Out of memory errors
✅ You're already working on database pools! 🎉
✅ Reduce `maxWorkers` in jest.config.js if needed
✅ Run `test:unit` instead of full suite locally

---

## 📚 Learn More

- Interactive Menu: `npm run t` → press `?`
- Full test list: `npm run` (shows all test commands)
- Test helpers: `tests/helpers/sharedSetup.ts`
- AI Coder Guide: `AI_CODER_GUIDE.md`

---

## 🎓 Remember

> **Don't memorize commands, just run `npm run t`**
>
> The interactive menu shows you what to run based on your context.
> It's smart enough to suggest the right tests at the right time.

---

**Last Updated**: 2025-10-12
**Version**: 1.0
**Strategy**: Implemented Strategy 3 with zero-memory interface
