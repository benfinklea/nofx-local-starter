import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');
const routes = [
  'api/agents/index.ts',
  'api/agents/publish.ts',
  'api/agents/[id]/index.ts',
  'api/agents/[id]/rollback.ts',
  'api/templates/index.ts',
  'api/templates/publish.ts',
  'api/templates/validate.ts',
  'api/templates/rate.ts',
  'api/templates/[id]/index.ts',
  'api/templates/[id]/rollback.ts'
];

let failures = 0;

for (const rel of routes) {
  const filePath = path.join(repoRoot, rel);
  const content = fs.readFileSync(filePath, 'utf8');
  const hasAdminGuard = content.includes('isAdmin');
  if (!hasAdminGuard) {
    console.error(`❌ ${rel} does not import or reference isAdmin()`);
    failures += 1;
    continue;
  }

  const hasUnauthorizedResponse = /status\(401\)/.test(content);
  if (!hasUnauthorizedResponse) {
    console.error(`❌ ${rel} never returns status(401); ensure admin check responds properly.`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`Registry route audit failed: ${failures} issue(s) detected.`);
  process.exit(1);
}

console.log('✅ All registry routes enforce admin authentication.');
