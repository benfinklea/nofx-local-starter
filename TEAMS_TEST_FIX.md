# Teams Routes Simple Test Failures - Root Cause Analysis and Fix

## Root Cause

All tests receiving 500 status codes with error: **"supabase.from(...).select(...).eq(...).single is not a function"**

### The Problem

The Supabase mock uses a "chainable thenable" pattern where:
1. Methods like `.from()`, `.select()`, `.eq()`, `.single()` return the chainable object for chaining
2. The object is "thenable" (has a `.then()` method) so it can be awaited at the end

However, when tests use `mockResolvedValueOnce()` on methods like `.eq()` or `.single()`, it breaks the chain:
- `.eq()` gets mocked to return `Promise.resolve({data: [], error: null})`
- The next `.eq()` or `.single()` call tries to execute on that Promise
- Promises don't have `.single()` methods → **"is not a function" error**

### Example of the Broken Pattern

```typescript
// InviteService line 173-176: Check for existing user
const { data: users } = await supabase
  .from('users')      // returns chainable
  .select('id')       // returns chainable
  .eq('email', email); // NEEDS to be awaitable here

// InviteService line 186-190: Check for existing member
const { data: existingMember } = await supabase
  .from('team_members')  // returns chainable
  .select('id')          // returns chainable
  .eq('team_id', teamId) // returns chainable - MUST continue chain
  .eq('user_id', userId); // NEEDS to be awaitable here
```

The test mocks this as:
```typescript
// This breaks the chain!
mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null });
```

When the code calls `.eq('team_id')`, it returns a Promise. Then calling `.eq('user_id')` on that Promise fails.

## The Solution

The mock needs to properly handle multi-step chains. There are two approaches:

### Approach 1: Use `.then()` Mock (Current Pattern)
Keep all chainable methods returning the chainable object, and only mock `.then()` to return different results:

```typescript
// This works because .then() is the final call when awaiting
(mockSupabase.then as jest.Mock)
  .mockImplementationOnce((resolve: Function) => {
    const result = { data: [], error: null };
    if (resolve) resolve(result);
    return Promise.resolve(result);
  });
```

### Approach 2: Track Call Sequences (Better for Complex Chains)
Create a more sophisticated mock that tracks the call sequence and returns chainable until the final method:

```typescript
let queryDepth = 0;
mockSupabase.eq.mockImplementation(() => {
  queryDepth++;
  // Return chainable for first .eq(), resolve for second .eq()
  if (queryDepth === 1) {
    return mockSupabase; // Continue chain
  } else {
    queryDepth = 0;
    return Promise.resolve({ data: [], error: null }); // Final result
  }
});
```

### Approach 3: Create Query-Specific Mocks (Most Robust)
Since the Services have predictable query patterns, create specific mock implementations for each query:

```typescript
function mockUserLookup(userData: any[]) {
  // .from('users').select('id').eq('email', email)
  mockSupabase.from.mockReturnValueOnce(mockSupabase);
  mockSupabase.select.mockReturnValueOnce(mockSupabase);
  mockSupabase.eq.mockResolvedValueOnce({ data: userData, error: null });
}

function mockMemberLookup(memberData: any[]) {
  // .from('team_members').select('id').eq('team_id', x).eq('user_id', y)
  mockSupabase.from.mockReturnValueOnce(mockSupabase);
  mockSupabase.select.mockReturnValueOnce(mockSupabase);
  mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq() - chainable
  mockSupabase.eq.mockResolvedValueOnce({ data: memberData, error: null }); // Second .eq() - final
}
```

## Required Fixes by Test

### 1. "should send invite successfully" (Line 248)

**Query Sequence:**
1. Team lookup: `.from('teams').select().eq().single()` → needs team data
2. User lookup: `.from('users').select().eq()` → needs empty array
3. Existing member check: `.from('team_members').select().eq().eq()` → needs empty array (but has 2 `.eq()` calls!)
4. Pending invite check: `.from('team_invites').select().eq().eq().eq()` → needs empty array (has 3 `.eq()` calls!)
5. Invite creation: `.from('team_invites').insert().select().single()` → needs invite data
6. Activity log: `.from('team_activity_logs').insert()` → needs success

**Current Problem (Lines 265-278):**
```typescript
mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null }); // ✓ OK
mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null }); // ✗ BREAKS CHAIN
mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null }); // ✗ BREAKS CHAIN
mockSupabase.single.mockResolvedValueOnce({ data: mockInvite, error: null }); // ✓ OK
mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null }); // ✗ BREAKS CHAIN
```

**Fix:**
```typescript
// 1. Team lookup - OK as-is
mockSupabase.single.mockResolvedValueOnce({ data: mockTeam, error: null });

// 2. User lookup: .select().eq() - last method resolves
mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null });

// 3. Member check: .select().eq().eq() - TWO eq() calls
mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq() chains
mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null }); // Second .eq() resolves

// 4. Pending invite check: .select().eq().eq().eq() - THREE eq() calls
mockSupabase.eq.mockReturnValueOnce(mockSupabase); // First .eq() chains
mockSupabase.eq.mockReturnValueOnce(mockSupabase); // Second .eq() chains
mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null }); // Third .eq() resolves

// 5. Invite creation: .insert().select().single() - OK as-is
mockSupabase.single.mockResolvedValueOnce({ data: mockInvite, error: null });

// 6. Activity log: .insert() alone doesn't need resolution
// The issue is .insert() returns chainable but nothing awaits it
// So we need to make sure .then() handles it
(mockSupabase.then as jest.Mock).mockImplementationOnce((resolve: Function) => {
  const result = { data: null, error: null };
  if (resolve) resolve(result);
  return Promise.resolve(result);
});
```

### 2. "should prevent inviting existing members" (Line 306)

Similar issue - needs proper chaining for the `.eq().eq()` call.

### 3. "should accept invite successfully" (Line 331)

**Query Sequence:**
1. Invite lookup: `.select().eq().single()` → invite data
2. Member insertion: `.insert()` → success
3. Invite update: `.update().eq()` → success
4. Activity log: `.insert()` → success

Current mocks look OK but `.insert()` calls need to resolve properly.

### 4. "should cancel invite" (Line 394)

**Query:** `.update().eq().eq()` - TWO `.eq()` calls, needs chaining fix.

### 5. "should remove member" (Line 458)

**Query Sequence:**
1. Get member: `.select().eq().eq().single()` - TWO `.eq()` calls before `.single()`
2. Delete: `.delete().eq().eq()` - TWO `.eq()` calls
3. Activity log: `.insert()`

Needs chaining fixes for both multi-`.eq()` sequences.

### 6. "should allow member to leave team" (Line 494)

Current implementation uses counter-based approach which is good, but the Promise return needs fixing:
```typescript
mockSupabase.eq.mockImplementation(() => {
  eqCallCount++;
  if (eqCallCount === 1 || eqCallCount === 2) {
    return Promise.resolve({ data: [{ id: 'member-123', role: 'member' }], error: null });
  }
  return Promise.resolve({ data: null, error: null });
});
```

Should be:
```typescript
mockSupabase.eq.mockImplementation(() => {
  eqCallCount++;
  if (eqCallCount === 1) {
    // First .eq() in chain - return chainable
    return mockSupabase;
  } else if (eqCallCount === 2) {
    // Second .eq() completes the check
    return Promise.resolve({ data: [{ id: 'member-123', role: 'member' }], error: null });
  }
  // Delete operation .eq() calls (also 2 of them)
  return mockSupabase; // Or handle appropriately
});
```

### 7. "should transfer ownership" (Line 533)

Similar multi-`.eq()` pattern needs fixing.

## Complete Fix Implementation

The cleanest fix is to modify the test to properly handle chainable methods. Each query needs its methods mocked in order, with only the FINAL method in the chain returning a resolved value.

### General Rule:
- Methods in the MIDDLE of a chain: `.mockReturnValueOnce(mockSupabase)`
- FINAL method before await: `.mockResolvedValueOnce({data, error})`
- Or use `.then()` mock for all awaits

Would you like me to implement the complete fix for all failing tests?
