# 📍 Team Playbook: How to Add a Navigation Entry

## Quick Start

To add a new navigation entry to the NOFX Control Plane:

1. Edit `/config/navigation-manifest.json`
2. Add your entry following the schema
3. Run `npm run nav:lint` to validate
4. Create a PR with your changes
5. CI will automatically validate the manifest

## Step-by-Step Guide

### Step 1: Understand the Navigation Structure

The navigation is organized into **groups** and **entries**:

- **Groups**: Top-level categories (e.g., "Operations", "Registry", "Observability")
- **Entries**: Individual navigation items within groups
- **Hierarchy**: Entries can have parent-child relationships

### Step 2: Choose the Right Group

| Group | Purpose | Examples |
|-------|---------|----------|
| `main` | Core dashboard and landing pages | Dashboard |
| `operations` | Run management and operations | Runs, Builder, Responses |
| `registry` | Agent and template management | Agents, Templates, Models |
| `observability` | Monitoring and debugging | Logs, Metrics, DLQ |
| `admin` | System administration | Settings, Billing, Projects |
| `developer` | Developer tools and utilities | Dev Tools, Navigation Console |

### Step 3: Create Your Navigation Entry

Add your entry to the `entries` array in `/config/navigation-manifest.json`:

```json
{
  "id": "your-feature-id",
  "label": "Your Feature Name",
  "path": "/your-feature-path",
  "icon": "YourIcon",
  "group": "appropriate-group",
  "order": 10,
  "description": "Brief description of your feature",
  "status": "beta",
  "ownership": {
    "team": "your-team",
    "slack": "#your-team-slack"
  }
}
```

### Step 4: Required Fields

Every navigation entry MUST have:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique identifier | `"user-management"` |
| `label` | string | Display name | `"User Management"` |
| `path` | string | Route path | `"/admin/users"` |
| `icon` | string | MUI icon name | `"PeopleIcon"` |
| `group` | string | Parent group ID | `"admin"` |
| `description` | string | Feature description | `"Manage users and permissions"` |
| `status` | enum | Feature maturity | `"stable"`, `"beta"`, `"alpha"` |
| `ownership.team` | string | Owning team | `"platform"` |

### Step 5: Optional Enhancements

#### Add Access Control

```json
"permissions": {
  "role": "admin",
  "feature_flag": "user_management_enabled"
}
```

#### Add Telemetry

```json
"telemetry": {
  "event_name": "nav_user_management_click",
  "track_clicks": true,
  "track_time_to_feature": true
}
```

#### Add Documentation Links

```json
"docs_url": "https://docs.nofx.io/user-management",
"support_url": "https://support.nofx.io/users",
"changelog_url": "https://changelog.nofx.io/user-management"
```

#### Add Health Monitoring

```json
"health_check_url": "/api/health/users",
"sli_targets": {
  "availability": 99.9,
  "latency_p99_ms": 200,
  "error_rate": 0.1
}
```

#### Add Test Coverage

```json
"test_suite_path": "tests/integration/user-management.test.ts"
```

#### Add Keyboard Shortcut

```json
"keyboard_shortcut": "g+u"
```

#### Add Badge

```json
"badge": "NEW"  // Options: "NEW", "BETA", "COMING SOON"
```

### Step 6: Validate Your Changes

Run the validation command to ensure your entry is correct:

```bash
npm run nav:lint
```

This will check for:
- ✅ Schema compliance
- ✅ Unique IDs and paths
- ✅ Valid parent references
- ✅ No circular dependencies
- ⚠️  Missing tests (warning)
- ⚠️  Missing documentation (warning)
- ⚠️  Missing telemetry (warning)

### Step 7: Test Locally

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the Developer Console:**
   ```
   http://localhost:5173/#/dev/navigation
   ```

3. **Verify your entry appears correctly:**
   - Check it's in the right group
   - Verify the path works
   - Confirm permissions are applied
   - Test any keyboard shortcuts

### Step 8: Submit Your Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b nav/add-your-feature
   ```

2. **Commit with a descriptive message:**
   ```bash
   git add config/navigation-manifest.json
   git commit -m "feat(nav): add user management to admin section"
   ```

3. **Push and create a PR:**
   ```bash
   git push origin nav/add-your-feature
   ```

4. **PR Description Template:**
   ```markdown
   ## Navigation Entry Added

   **Feature:** User Management
   **Path:** /admin/users
   **Group:** admin
   **Status:** beta

   ### Checklist
   - [ ] Entry follows schema requirements
   - [ ] `npm run nav:lint` passes
   - [ ] Path exists in application
   - [ ] Ownership information is correct
   - [ ] Documentation URL provided (if stable)
   - [ ] Test suite path provided (if stable)
   - [ ] Telemetry configured
   ```

## Common Patterns

### Sub-Navigation Entry

For entries that are children of other entries:

```json
{
  "id": "user-roles",
  "label": "Roles & Permissions",
  "path": "/admin/users/roles",
  "parent_id": "user-management",  // Reference to parent entry
  // ... other fields
}
```

### Feature Behind Flag

For features in rollout:

```json
{
  "id": "experimental-feature",
  "status": "experimental",
  "rollout_percentage": 10,  // Only show to 10% of users
  "permissions": {
    "feature_flag": "experimental_features_enabled"
  },
  "badge": "BETA",
  // ... other fields
}
```

### Coming Soon Feature

For planned features:

```json
{
  "id": "upcoming-feature",
  "label": "Advanced Analytics",
  "path": "/analytics",
  "badge": "COMING SOON",
  "disabled": true,  // Prevents navigation
  "rollout_percentage": 0,
  // ... other fields
}
```

## Rollout Strategies

### Progressive Rollout

1. **Alpha Phase:**
   ```json
   "status": "alpha",
   "rollout_percentage": 5,
   "permissions": { "role": "developer" }
   ```

2. **Beta Phase:**
   ```json
   "status": "beta",
   "rollout_percentage": 25,
   "badge": "BETA"
   ```

3. **General Availability:**
   ```json
   "status": "stable",
   "rollout_percentage": 100
   ```

## Monitoring Your Entry

Once deployed, monitor your navigation entry through:

1. **Navigation Console:** `/dev/navigation`
   - Health status checks
   - Permission validation
   - Missing documentation warnings

2. **Telemetry Dashboard:**
   - Click-through rates
   - Time to feature metrics
   - Error rates

3. **Alerts:**
   - Automatic alerts on entry unavailability
   - Degraded performance notifications

## Best Practices

### DO:
- ✅ Always include ownership information
- ✅ Add telemetry from day one
- ✅ Provide documentation URLs for stable features
- ✅ Use descriptive IDs that won't change
- ✅ Test navigation paths before committing
- ✅ Include keyboard shortcuts for frequently used features
- ✅ Add health checks for critical features

### DON'T:
- ❌ Use duplicate IDs or paths
- ❌ Create circular parent-child relationships
- ❌ Skip validation before committing
- ❌ Forget to update ownership when teams change
- ❌ Leave test_suite_path empty for stable features
- ❌ Use 100% rollout for experimental features

## Troubleshooting

### Entry Not Appearing

1. Check permissions are satisfied
2. Verify rollout percentage
3. Ensure not marked as `hidden` or `disabled`
4. Check feature flags are enabled
5. Validate manifest with `npm run nav:lint`

### Validation Errors

| Error | Solution |
|-------|----------|
| Duplicate ID | Choose a unique identifier |
| Missing route | Create the route or fix the path |
| Orphaned entry | Fix or remove parent_id reference |
| Circular dependency | Review parent-child relationships |
| Schema validation failed | Check required fields and types |

### Health Check Failures

1. Verify the health check URL is correct
2. Ensure the endpoint returns appropriate status codes
3. Check authentication/authorization on health endpoint
4. Monitor response times against SLI targets

## Support

- **Slack:** #nofx-platform for navigation issues
- **Documentation:** https://docs.nofx.io/navigation
- **Navigation Console:** /dev/navigation for diagnostics

## Appendix: Available Icons

Common MUI icons for navigation entries:

| Category | Icons |
|----------|-------|
| General | `DashboardIcon`, `HomeIcon`, `MenuIcon` |
| Operations | `PlayArrowIcon`, `BuildIcon`, `SettingsIcon` |
| Data | `StorageIcon`, `FolderIcon`, `DescriptionIcon` |
| Monitoring | `TimelineIcon`, `InsightsIcon`, `ArticleIcon` |
| Admin | `PeopleIcon`, `SecurityIcon`, `PaymentIcon` |
| Developer | `CodeIcon`, `BugReportIcon`, `BuildCircleIcon` |
| Status | `CheckCircleIcon`, `ErrorIcon`, `WarningIcon` |

For a complete list, see: https://mui.com/material-ui/material-icons/