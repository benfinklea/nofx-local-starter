#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NavigationManifest } from '../src/types/navigation-manifest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

interface ValidationError {
  type: 'schema' | 'duplicate' | 'missing_route' | 'orphaned' | 'circular';
  entry?: string;
  message: string;
}

interface ValidationWarning {
  type: 'missing_test' | 'missing_docs' | 'deprecated' | 'no_owner' | 'no_telemetry' | 'missing_route';
  entry: string;
  message: string;
}

interface ValidationStats {
  totalEntries: number;
  byStatus: Record<string, number>;
  byGroup: Record<string, number>;
  testCoverage: number;
  docsCoverage: number;
  telemetryCoverage: number;
}

class NavigationValidator {
  private manifest: NavigationManifest | null = null;
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];
  private routeFiles: Set<string> = new Set();

  async loadManifest(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate schema
      const result = NavigationManifest.safeParse(data);
      if (!result.success) {
        this.errors.push({
          type: 'schema',
          message: `Schema validation failed: ${result.error.message}`
        });
        return false;
      }

      this.manifest = result.data;
      return true;
    } catch (_error) {
      this.errors.push({
        type: 'schema',
        message: `Failed to load manifest: ${_error}`
      });
      return false;
    }
  }

  async loadRouteFiles(): Promise<void> {
    // Load frontend routes from App.tsx
    const appPath = path.join(__dirname, '../apps/frontend/src/App.tsx');
    try {
      const appContent = await fs.readFile(appPath, 'utf-8');
      // Extract route paths from React Router
      const routeMatches = appContent.matchAll(/path="([^"]+)"/g);
      for (const match of routeMatches) {
        this.routeFiles.add(match[1]);
      }
    } catch (_error) {
      console.warn(`Warning: Could not load routes from App.tsx: ${_error}`);
    }

    // Load API routes
    const apiDir = path.join(__dirname, '../src/api');
    try {
      await this.scanApiRoutes(apiDir);
    } catch (_error) {
      console.warn(`Warning: Could not scan API routes: ${_error}`);
    }
  }

  private async scanApiRoutes(dir: string, prefix = '/api'): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanApiRoutes(fullPath, `${prefix}/${entry.name}`);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          const routeName = entry.name.replace('.ts', '');
          if (routeName !== 'index') {
            this.routeFiles.add(`${prefix}/${routeName}`);
          }
        }
      }
    } catch (_error) {
      // Silent fail for missing directories
    }
  }

  validate(): ValidationResult {
    if (!this.manifest) {
      return {
        valid: false,
        errors: this.errors,
        warnings: this.warnings,
        stats: this.getEmptyStats()
      };
    }

    // Check for duplicate IDs
    this.checkDuplicateIds();

    // Check for orphaned entries (parent_id references)
    this.checkOrphanedEntries();

    // Check for circular dependencies
    this.checkCircularDependencies();

    // Check route existence
    this.checkRouteExistence();

    // Check for missing tests
    this.checkMissingTests();

    // Check for missing documentation
    this.checkMissingDocs();

    // Check for deprecated entries
    this.checkDeprecatedEntries();

    // Check for missing telemetry
    this.checkMissingTelemetry();

    const stats = this.calculateStats();

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      stats
    };
  }

  private checkDuplicateIds(): void {
    const ids = new Set<string>();
    const duplicates = new Set<string>();

    for (const entry of this.manifest!.entries) {
      if (ids.has(entry.id)) {
        duplicates.add(entry.id);
      }
      ids.add(entry.id);
    }

    for (const duplicate of duplicates) {
      this.errors.push({
        type: 'duplicate',
        entry: duplicate,
        message: `Duplicate entry ID: ${duplicate}`
      });
    }

    // Check for duplicate paths
    const paths = new Set<string>();
    const duplicatePaths = new Set<string>();

    for (const entry of this.manifest!.entries) {
      if (paths.has(entry.path)) {
        duplicatePaths.add(entry.path);
      }
      paths.add(entry.path);
    }

    for (const path of duplicatePaths) {
      this.errors.push({
        type: 'duplicate',
        message: `Duplicate path: ${path}`
      });
    }
  }

  private checkOrphanedEntries(): void {
    const ids = new Set(this.manifest!.entries.map((e: any) => e.id));

    for (const entry of this.manifest!.entries) {
      if (entry.parent_id && !ids.has(entry.parent_id)) {
        this.errors.push({
          type: 'orphaned',
          entry: entry.id,
          message: `Entry "${entry.id}" references non-existent parent "${entry.parent_id}"`
        });
      }
    }
  }

  private checkCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (id: string): boolean => {
      if (recursionStack.has(id)) return true;
      if (visited.has(id)) return false;

      visited.add(id);
      recursionStack.add(id);

      const entry = this.manifest!.entries.find((e: any) => e.id === id);
      if (entry?.parent_id) {
        if (hasCycle(entry.parent_id)) {
          return true;
        }
      }

      recursionStack.delete(id);
      return false;
    };

    for (const entry of this.manifest!.entries) {
      if (hasCycle(entry.id)) {
        this.errors.push({
          type: 'circular',
          entry: entry.id,
          message: `Circular dependency detected for entry "${entry.id}"`
        });
      }
    }
  }

  private checkRouteExistence(): void {
    if (this.routeFiles.size === 0) {
      console.warn('Warning: No route files loaded, skipping route existence check');
      return;
    }

    for (const entry of this.manifest!.entries) {
      // Skip external URLs and special paths
      if (entry.path.startsWith('http://') || entry.path.startsWith('https://')) {
        continue;
      }

      // Check if route exists in the application
      const routeExists = this.routeFiles.has(entry.path) ||
                          this.routeFiles.has(entry.path.replace(/\/:\w+/g, '/:id'));

      if (!routeExists && !entry.path.includes('/dev/navigation')) {
        this.warnings.push({
          type: 'missing_route',
          entry: entry.id,
          message: `Route "${entry.path}" not found in application`
        });
      }
    }
  }

  private checkMissingTests(): void {
    for (const entry of this.manifest!.entries) {
      if (!entry.test_suite_path && entry.status === 'stable') {
        this.warnings.push({
          type: 'missing_test',
          entry: entry.id,
          message: `Stable entry "${entry.label}" is missing test suite`
        });
      }
    }
  }

  private checkMissingDocs(): void {
    for (const entry of this.manifest!.entries) {
      if (!entry.docs_url && entry.status === 'stable') {
        this.warnings.push({
          type: 'missing_docs',
          entry: entry.id,
          message: `Stable entry "${entry.label}" is missing documentation URL`
        });
      }
    }
  }

  private checkDeprecatedEntries(): void {
    for (const entry of this.manifest!.entries) {
      if (entry.status === 'deprecated') {
        this.warnings.push({
          type: 'deprecated',
          entry: entry.id,
          message: `Entry "${entry.label}" is marked as deprecated`
        });
      }
    }
  }

  private checkMissingTelemetry(): void {
    for (const entry of this.manifest!.entries) {
      if (!entry.telemetry && entry.status === 'stable') {
        this.warnings.push({
          type: 'no_telemetry',
          entry: entry.id,
          message: `Stable entry "${entry.label}" is missing telemetry configuration`
        });
      }
    }
  }

  private calculateStats(): ValidationStats {
    const entries = this.manifest!.entries;
    const total = entries.length;

    const byStatus: Record<string, number> = {};
    const byGroup: Record<string, number> = {};

    for (const entry of entries) {
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
      byGroup[entry.group] = (byGroup[entry.group] || 0) + 1;
    }

    const withTests = entries.filter((e: any) => e.test_suite_path).length;
    const withDocs = entries.filter((e: any) => e.docs_url).length;
    const withTelemetry = entries.filter((e: any) => e.telemetry).length;

    return {
      totalEntries: total,
      byStatus,
      byGroup,
      testCoverage: Math.round((withTests / total) * 100),
      docsCoverage: Math.round((withDocs / total) * 100),
      telemetryCoverage: Math.round((withTelemetry / total) * 100),
    };
  }

  private getEmptyStats(): ValidationStats {
    return {
      totalEntries: 0,
      byStatus: {},
      byGroup: {},
      testCoverage: 0,
      docsCoverage: 0,
      telemetryCoverage: 0,
    };
  }
}

// CLI execution
async function main() {
  const manifestPath = path.join(__dirname, '../config/navigation-manifest.json');
  const validator = new NavigationValidator();

  console.log('🔍 Validating navigation manifest...\n');

  // Load manifest
  const loaded = await validator.loadManifest(manifestPath);
  if (!loaded) {
    console.error('❌ Failed to load manifest');
    process.exit(1);
  }

  // Load route files for validation
  await validator.loadRouteFiles();

  // Run validation
  const result = validator.validate();

  // Print results
  console.log('📊 Statistics:');
  console.log(`  Total Entries: ${result.stats.totalEntries}`);
  console.log(`  Test Coverage: ${result.stats.testCoverage}%`);
  console.log(`  Docs Coverage: ${result.stats.docsCoverage}%`);
  console.log(`  Telemetry Coverage: ${result.stats.telemetryCoverage}%`);
  console.log('');

  console.log('  By Status:');
  for (const [status, count] of Object.entries(result.stats.byStatus)) {
    console.log(`    ${status}: ${count}`);
  }
  console.log('');

  console.log('  By Group:');
  for (const [group, count] of Object.entries(result.stats.byGroup)) {
    console.log(`    ${group}: ${count}`);
  }
  console.log('');

  // Print errors
  if (result.errors.length > 0) {
    console.error('❌ Errors:');
    for (const error of result.errors) {
      console.error(`  - ${error.message}`);
    }
    console.log('');
  }

  // Print warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️  Warnings:');
    for (const warning of result.warnings) {
      console.warn(`  - ${warning.message}`);
    }
    console.log('');
  }

  // Final result
  if (result.valid) {
    console.log('✅ Navigation manifest is valid!');
    if (result.warnings.length > 0) {
      console.log(`   (with ${result.warnings.length} warnings)`);
    }
  } else {
    console.error('❌ Navigation manifest validation failed!');
    console.error(`   ${result.errors.length} errors found`);
    process.exit(1);
  }
}

// Run if executed directly
main().catch((error: any) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { NavigationValidator, ValidationResult };