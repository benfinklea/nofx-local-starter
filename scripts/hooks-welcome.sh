#!/bin/bash

# Welcome message for smart hooks
cat << 'EOF'

╔═══════════════════════════════════════════════════════════════╗
║        🎯 SMART HOOKS ENABLED - Test Automation Active       ║
╚═══════════════════════════════════════════════════════════════╝

What happens now:

📝 On Commit (auto-runs, ~30s):
   • Security checks (secrets, dangerous code)
   • Auto-lint your code
   • Test changed files only
   • Validate commit message

🚀 On Push (auto-runs, ~2min):
   • Full unit test suite
   • TypeScript type check
   • (CI handles integration/e2e)

💡 Quick Commands:
   npm run t          # Interactive test menu (pick what you need)
   npm run t:watch    # Watch mode (tests run as you code)
   npm run t:fast     # Changed files only (30s)

🔧 Switch Hook Modes:
   npm run hooks:ultra     # Maximum validation (slower)
   npm run hooks:fast      # Quick checks only
   npm run hooks:minimal   # Almost nothing
   npm run hooks:off       # Disable (not recommended)

🆘 Emergency Bypass:
   git commit --no-verify  # Skip hooks once
   git push --no-verify    # Skip hooks once

📚 Learn More:
   docs/QUICK_START_TESTING.md      # 2-minute guide
   docs/GIT_HOOKS_GUIDE.md          # Full documentation
   npm run t → press '?'            # Interactive help

════════════════════════════════════════════════════════════════

✅ You're all set! Start coding with 'npm run t:watch'

EOF
