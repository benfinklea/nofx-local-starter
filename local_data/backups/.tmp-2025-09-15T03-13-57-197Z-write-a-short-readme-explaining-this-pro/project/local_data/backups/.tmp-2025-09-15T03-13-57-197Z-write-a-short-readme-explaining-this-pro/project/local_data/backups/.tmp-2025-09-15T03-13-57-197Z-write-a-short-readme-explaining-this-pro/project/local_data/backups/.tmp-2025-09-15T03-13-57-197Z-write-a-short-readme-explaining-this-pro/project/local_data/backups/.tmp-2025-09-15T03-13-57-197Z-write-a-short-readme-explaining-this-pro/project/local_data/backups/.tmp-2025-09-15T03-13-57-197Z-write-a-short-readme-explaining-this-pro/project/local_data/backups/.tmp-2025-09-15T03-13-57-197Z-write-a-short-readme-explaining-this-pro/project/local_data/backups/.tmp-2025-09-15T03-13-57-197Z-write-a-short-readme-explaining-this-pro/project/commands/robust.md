---
name: robust
description: Improve code reliability with practical fixes - no over-engineering
---

## Scope Determination

{{if contains $ARGUMENTS "--all"}}
**Mode: FULL CODEBASE ANALYSIS** 
Scanning entire project for reliability improvements...
{{else}}
**Mode: RECENT CHANGES ONLY**
Focusing on recently modified code. Use `/robust --all` for full codebase analysis.
{{/if}}

Improve the existing code with practical reliability fixes. Focus on **simple, effective improvements** without reinventing or replacing working systems.

## What to Fix (Keep It Simple)

### 1. **Basic Error Handling**
- Add missing try-catch blocks only where needed
- Fix uncaught promise rejections 
- Handle obvious null/undefined cases
- Return meaningful error messages

### 2. **Input Validation** 
- Check for required parameters
- Validate types where it matters
- Handle empty/malformed inputs gracefully
- Don't over-validate - trust internal calls

### 3. **Resource Cleanup**
- Close files, connections, streams properly
- Clear timers and intervals
- Remove event listeners when done
- Fix memory leaks (obvious ones only)

### 4. **Async Operations**
- Add reasonable timeouts (don't go crazy)
- Handle network failures gracefully
- Fix race conditions if they exist
- Use proper error propagation

## What NOT to Do (Avoid Over-Engineering)

❌ Don't create new "enterprise" versions of existing systems
❌ Don't add circuit breakers unless absolutely necessary  
❌ Don't implement retry logic with exponential backoff everywhere
❌ Don't create elaborate monitoring systems
❌ Don't add complex state management if simple works
❌ Don't replace working code with "more robust" alternatives
❌ Don't add layers of abstraction for reliability

## Implementation Approach

1. **Preserve Working Code**: If it works, don't replace it
2. **Fix Obvious Problems**: Handle the clear failure points
3. **Improve Gradually**: Small, targeted improvements
4. **Keep It Readable**: Don't sacrifice clarity for robustness
5. **Test Changes**: Make sure improvements don't break functionality

## Target Issues to Address

- Functions that can crash on bad input
- Unhandled promise rejections
- Missing null checks in critical paths
- Resource leaks (files, connections)
- Silent failures that should be logged
- Race conditions in async code

## Success Criteria

✅ Code handles edge cases without crashing
✅ Errors are caught and logged appropriately  
✅ Resources are cleaned up properly
✅ Functions fail gracefully with useful messages
✅ No new complexity added unnecessarily
✅ Original functionality preserved

Focus on **practical reliability** over theoretical perfection. Make the code more stable without making it more complicated.

## Command Completion

✅ `/robust $ARGUMENTS` command complete.

Summary: Applied targeted reliability improvements while preserving existing functionality and avoiding over-engineering.