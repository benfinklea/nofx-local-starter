# Navigation Troubleshooting Guide

## "Agents" Link Not Showing in Navigation

The Agents link is already configured in the navigation manifest (`config/navigation-manifest.json`) but may not appear due to caching.

### Quick Fix Options:

#### Option 1: Hard Refresh (Recommended)
1. **Chrome/Edge**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Firefox**: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)
3. **Safari**: `Cmd+Option+R`

#### Option 2: Clear Browser Cache
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

#### Option 3: Restart Dev Server
```bash
# Stop the dev server (Ctrl+C)
# Then restart
npm run dev
```

#### Option 4: Clear API Cache
The navigation manifest is cached for 5 minutes in production. If you're seeing stale data:
1. Wait 5 minutes, or
2. Restart your backend server

#### Option 5: Check Console for Errors
1. Open DevTools Console (F12)
2. Look for errors related to "navigation" or "manifest"
3. Check Network tab for `/api/navigation/manifest` request
4. Verify the response includes the "agents" entry

### Verify Agents Entry Exists

Check the manifest directly:
```bash
cat config/navigation-manifest.json | grep -A 5 '"agents"'
```

Should show:
```json
{
  "id": "agents",
  "label": "Agents",
  "path": "/agents",
  "icon": "SmartToyIcon",
  "group": "registry"
}
```

### Expected Navigation Structure

The Agents link should appear in the **Registry** section of the sidebar:
- Dashboard (Main)
- Runs (Operations)
- Plan Builder (Operations)
- **Registry** ⬅️ Expand this section
  - **Agents** ⬅️ Should be here
  - Templates
  - Models

### Direct Access

You can always access the Agents page directly by navigating to:
```
http://localhost:5173/#/agents
```

### Debugging Steps

1. **Check if manifest loads:**
   ```javascript
   // In browser console:
   fetch('/api/navigation/manifest')
     .then(r => r.json())
     .then(m => console.log(m.entries.find(e => e.id === 'agents')))
   ```

2. **Check icon mapping:**
   The icon `SmartToyIcon` must exist in `ManifestShell.tsx` ICON_MAP
   - We've already added it: `SmartToyIcon: SmartToy`

3. **Check permissions:**
   The Agents entry has no special permissions, so it should be visible to all users

### Still Not Working?

If the link still doesn't appear:
1. Check browser console for JavaScript errors
2. Verify the app is using `ManifestShell` (not `SimpleShell`)
3. Check `App.tsx` - the route should exist: `<Route path="/agents" element={<Agents/>} />`
4. Try accessing `/agents` directly to verify the page works

### Alternative: Use TopBar Navigation

We also added Agents to the simple TopBar navigation as a fallback. If you see the top navigation bar (Runs, Models, Settings), the Agents link should be there too.
