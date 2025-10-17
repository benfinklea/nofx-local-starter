# 🎯 Quick Wins Week - Implementation Plan

**Date Started**: 2025-10-16
**Status**: Ready to Execute
**Goal**: Close all 14-day plan gaps in ~1 week

---

## Overview

After completing the Agent SDK Migration (saving ~12 weeks), we're now tackling the remaining minor gaps from the 14-day plan. These are all high-value, low-risk items with backend already complete.

---

## Day 1-2: Email Features (6-9 hours total)

### Task 1: Wire Password Reset Email (2-4 hours)

**Current State**:
- ✅ Resend integration working
- ✅ Email template reference (WelcomeEmail.tsx)
- ❌ Password reset email not created
- ❌ Not wired to Supabase auth

**Implementation Steps**:
1. Create `src/features/emails/PasswordResetEmail.tsx`
   - Follow WelcomeEmail.tsx pattern
   - Include reset link with token
   - Clear instructions for user
   - Security notice

2. Create email service function
   - `src/services/email/authEmails.ts`
   - `sendPasswordResetEmail(email, resetToken, resetUrl)`

3. Wire to Supabase auth
   - Configure Supabase email templates (custom SMTP redirect)
   - OR use Supabase webhooks to trigger our email
   - Test with `supabase.auth.resetPasswordForEmail()`

4. Test end-to-end
   - Request password reset
   - Receive email
   - Click link
   - Reset password
   - Confirm login works

**Acceptance Criteria**:
- User can request password reset
- Email arrives within 30 seconds
- Reset link works
- Password can be changed
- User can log in with new password

---

### Task 2: Usage Limit Warning Email (2-3 hours)

**Current State**:
- ❌ No template
- ❌ No threshold detection
- ✅ Usage tracking exists (in billing)

**Implementation Steps**:
1. Create `src/features/emails/UsageLimitWarningEmail.tsx`
   - Show current usage vs limit
   - Warn at 80%, 90%, 100%
   - Include upgrade CTA
   - Link to usage dashboard

2. Create usage monitoring service
   - `src/services/usage/usageMonitor.ts`
   - Check usage against limits
   - Emit events at thresholds
   - Debounce to avoid spam

3. Add cron job or event trigger
   - Daily check OR
   - On each API call (cached check)
   - Send email at 80%, 90%, 100%

4. Test
   - Mock usage at 80%
   - Verify email sends
   - Check throttling works

**Acceptance Criteria**:
- Email sends at 80% usage
- Email sends at 90% usage
- Email sends at 100% usage
- Users not spammed (max 1 email per threshold)
- Includes upgrade link

---

### Task 3: Automate Stripe Fixtures (4-6 hours)

**Current State**:
- ✅ Stripe integration working
- ❌ Products created manually
- ❌ Prices created manually
- ❌ Webhooks configured manually

**Implementation Steps**:
1. Create `scripts/setup-stripe.ts`
   - Create products (Free, Starter, Pro, Enterprise)
   - Create prices for each product
   - Set up webhook endpoint
   - Configure webhook events
   - Return setup summary

2. Create Stripe fixtures file
   - `config/stripe-fixtures.ts`
   - Product definitions
   - Price configurations
   - Feature lists per tier

3. Add npm scripts
   - `npm run stripe:setup` - full setup
   - `npm run stripe:products` - just products
   - `npm run stripe:webhooks` - just webhooks
   - `npm run stripe:status` - check setup

4. Test
   - Run setup script
   - Verify products in Stripe dashboard
   - Verify prices correct
   - Verify webhook working
   - Test subscription flow

**Acceptance Criteria**:
- Script creates all products/prices
- Webhook auto-configured
- Can run idempotently (re-run safe)
- Clear success/error messages
- Documentation included

---

## Day 3-4: Team Management UI (1-2 days)

**Current State**:
- ✅ Backend API 100% complete (teams, members, invites, RBAC)
- ✅ Database schema complete
- ✅ Email templates (TeamInviteEmail.tsx)
- ❌ No frontend UI

### Task 4: Teams Page (4-6 hours)

**Implementation**:
1. Create `apps/frontend/src/pages/Teams.tsx`
   ```typescript
   // Features:
   // - List all teams user is member of
   // - Show current team (highlighted)
   // - Create new team button
   // - Team card with member count
   // - Quick actions (settings, leave)
   ```

2. Team detail view (modal or separate route)
   - Team name and settings
   - Member list with roles
   - Pending invites
   - Leave/delete team options

**Acceptance Criteria**:
- User can see all their teams
- Current team highlighted
- Can create new team
- Can view team details
- Responsive design

---

### Task 5: Team Switcher Component (2-3 hours)

**Implementation**:
1. Create `apps/frontend/src/components/TeamSwitcher.tsx`
   ```typescript
   // Features:
   // - Dropdown with team list
   // - Current team shown
   // - Switch team action (updates context)
   // - Create new team option
   // - Appears in header/nav
   ```

2. Add team context
   - `apps/frontend/src/contexts/TeamContext.tsx`
   - Current team state
   - Switch team function
   - Persist in localStorage

**Acceptance Criteria**:
- Visible in header/nav
- Shows current team
- Can switch teams
- Creates new team
- Updates immediately

---

### Task 6: Member Management Interface (4-5 hours)

**Implementation**:
1. Create `apps/frontend/src/components/TeamMembers.tsx`
   ```typescript
   // Features:
   // - Member list with roles
   // - Add member button (shows invite modal)
   // - Change role dropdown
   // - Remove member action
   // - Transfer ownership
   ```

2. Member actions
   - Inline role change
   - Remove confirmation
   - Transfer ownership flow

**Acceptance Criteria**:
- List all members with roles
- Can change member roles
- Can remove members
- Can transfer ownership
- Proper permissions (only owner/admin)

---

### Task 7: Invite Flow UI (3-4 hours)

**Implementation**:
1. Create `apps/frontend/src/components/InviteTeamMember.tsx`
   ```typescript
   // Features:
   // - Email input
   // - Role selector
   // - Optional message
   // - Send invite button
   // - Shows pending invites
   ```

2. Pending invites management
   - List pending invites
   - Resend invite
   - Cancel invite
   - Copy invite link

**Acceptance Criteria**:
- Can invite by email
- Can select role
- Email sent
- Pending invites shown
- Can cancel invites

---

## Day 5: Test & Polish (1 day)

### Task 8: Integration Testing

**What to Test**:
1. Password reset flow
2. Usage warning emails trigger correctly
3. Stripe setup script works
4. Team creation/switching works
5. Member invitation works
6. All role permissions work

**Test Scenarios**:
```bash
# Password reset
1. Request reset
2. Receive email
3. Click link
4. Change password
5. Login with new password

# Usage warnings
1. Mock usage at 85%
2. Verify email sent
3. Mock usage at 95%
4. Verify email sent
5. Check no duplicates

# Team management
1. Create team
2. Invite member
3. Accept invite
4. Change role
5. Switch teams
6. Leave team
```

---

### Task 9: Documentation

**Documents to Update**:
1. `docs/QUICK_WINS_COMPLETE.md` - Completion report
2. Update `README.md` - New features section
3. Update user guides with team management
4. Add Stripe setup to deployment docs

---

### Task 10: Celebration! 🎉

**Summary Report**:
- All 14-day plan gaps closed
- 5 features shipped in ~1 week
- Better user experience throughout
- Clean slate for next initiative

---

## Success Metrics

**Completion Criteria**:
- ✅ Password reset working end-to-end
- ✅ Usage warnings sending at thresholds
- ✅ Stripe setup fully automated
- ✅ Team UI self-service working
- ✅ All features tested
- ✅ Documentation updated

**User Impact**:
- Better auth experience (password reset)
- Proactive communication (usage warnings)
- Faster developer onboarding (Stripe automation)
- Self-service team management (no manual intervention)

---

## Time Estimate

| Task | Estimate | Priority |
|------|----------|----------|
| Password Reset Email | 2-4 hours | HIGH |
| Usage Limit Warnings | 2-3 hours | MEDIUM |
| Stripe Automation | 4-6 hours | MEDIUM |
| Teams Page | 4-6 hours | HIGH |
| Team Switcher | 2-3 hours | HIGH |
| Member Management | 4-5 hours | MEDIUM |
| Invite Flow UI | 3-4 hours | MEDIUM |
| Testing | 4 hours | HIGH |
| Documentation | 2 hours | MEDIUM |

**Total**: ~27-37 hours (about 1 week at 6-8 hours/day)

---

## Next Steps

1. **Start with Password Reset** (highest value, lowest risk)
2. **Then Usage Warnings** (proactive UX improvement)
3. **Then Stripe Automation** (developer experience)
4. **Then Team UI** (all backend done, just needs frontend)
5. **Test everything**
6. **Document and celebrate!**

---

**Ready to start!** 🚀

Begin with Task 1: Create PasswordResetEmail.tsx and wire to Supabase auth.
