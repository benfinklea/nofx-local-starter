/**
 * Package.json Script Recursion Prevention Tests
 *
 * These tests ensure that npm scripts cannot create infinite recursive loops
 * that spawn runaway processes.
 *
 * Context: Previously, `dev:mock` called `npm:dev` which used `dev:*` wildcard,
 * causing it to match and re-run `dev:mock`, creating hundreds of processes.
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Package.json Script Recursion Prevention', () => {
  let packageJson: any;

  beforeAll(() => {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(packageJsonContent);
  });

  describe('dev:* pattern safety', () => {
    it('should not use wildcard dev:* pattern in the dev script', () => {
      const devScript = packageJson.scripts.dev;

      // The dev script should not use a wildcard pattern that could match itself
      expect(devScript).toBeDefined();
      expect(devScript).not.toMatch(/dev:\*/);

      // Should explicitly list scripts
      expect(devScript).toMatch(/dev:api/);
      expect(devScript).toMatch(/dev:worker/);
    });

    it('should not have any dev:* script that calls npm run dev', () => {
      const scripts = packageJson.scripts;
      const devPrefixedScripts = Object.keys(scripts).filter(key => key.startsWith('dev:'));

      devPrefixedScripts.forEach(scriptName => {
        const scriptContent = scripts[scriptName];

        // No dev:* script should call "npm run dev" or "npm:dev"
        expect(scriptContent).not.toMatch(/npm\s+run\s+dev[^:]|npm:dev[^:]/);

        // Also check for indirect calls through concurrently
        if (scriptContent.includes('concurrently') && scriptContent.includes('npm:dev')) {
          fail(`Script "${scriptName}" uses concurrently with npm:dev which could cause recursion`);
        }
      });
    });

    it('should not have circular dependencies between dev:* scripts', () => {
      const scripts = packageJson.scripts;
      const devPrefixedScripts = Object.keys(scripts).filter(key => key.startsWith('dev:'));

      // Build a dependency graph
      const callGraph: Record<string, string[]> = {};

      devPrefixedScripts.forEach(scriptName => {
        const scriptContent = scripts[scriptName];
        const calledScripts: string[] = [];

        // Check for npm run dev:* or npm:dev:* patterns
        const npmRunMatches = scriptContent.match(/npm\s+run\s+(dev:\w+)/g) || [];
        const npmMatches = scriptContent.match(/npm:(dev:\w+)/g) || [];

        npmRunMatches.forEach((match: string) => {
          const called = match.replace(/npm\s+run\s+/, '');
          if (devPrefixedScripts.includes(called)) {
            calledScripts.push(called);
          }
        });

        npmMatches.forEach((match: string) => {
          const called = match.replace(/npm:/, '');
          if (devPrefixedScripts.includes(called)) {
            calledScripts.push(called);
          }
        });

        callGraph[scriptName] = calledScripts;
      });

      // Detect cycles using DFS
      const hasCycle = (node: string, visited: Set<string>, recStack: Set<string>): boolean => {
        visited.add(node);
        recStack.add(node);

        const neighbors = callGraph[node] || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor, visited, recStack)) {
              return true;
            }
          } else if (recStack.has(neighbor)) {
            return true; // Cycle detected
          }
        }

        recStack.delete(node);
        return false;
      };

      const visited = new Set<string>();
      for (const script of devPrefixedScripts) {
        if (!visited.has(script)) {
          if (hasCycle(script, visited, new Set())) {
            fail(`Circular dependency detected in dev:* scripts involving "${script}"`);
          }
        }
      }
    });
  });

  describe('mock script safety', () => {
    it('should not have a dev:mock script', () => {
      const scripts = packageJson.scripts;

      // dev:mock was the original problematic script name
      expect(scripts['dev:mock']).toBeUndefined();
    });

    it('should have a start:mock or mock:dev script instead', () => {
      const scripts = packageJson.scripts;

      // Should use a naming pattern that doesn't match dev:*
      const hasAlternative = scripts['start:mock'] || scripts['mock:dev'];
      expect(hasAlternative).toBeDefined();
    });

    it('should not have mock-related script that would be caught by dev:* wildcard', () => {
      const scripts = packageJson.scripts;
      const devPrefixedScripts = Object.keys(scripts).filter(key => key.startsWith('dev:'));

      // No dev:* script should have "mock" in the name if it calls dev
      devPrefixedScripts.forEach(scriptName => {
        if (scriptName.includes('mock')) {
          const scriptContent = scripts[scriptName];
          expect(scriptContent).not.toMatch(/npm:dev[^:]|npm\s+run\s+dev[^:]/);
        }
      });
    });
  });

  describe('wildcard pattern safety', () => {
    it('should not have any script that uses wildcard to call scripts matching itself', () => {
      const scripts = packageJson.scripts;

      Object.entries(scripts).forEach(([scriptName, scriptContent]) => {
        if (typeof scriptContent === 'string') {
          // Extract prefix from script name (e.g., "dev" from "dev:api")
          const prefix = scriptName.split(':')[0];

          // Check if this script uses a wildcard that would match itself
          const wildcardPattern = new RegExp(`${prefix}:\\*`);

          if (wildcardPattern.test(scriptContent)) {
            // This script uses a wildcard pattern
            // Make sure the script name doesn't match this pattern
            const scriptMatchesOwnWildcard = scriptName.startsWith(`${prefix}:`);

            if (scriptMatchesOwnWildcard) {
              fail(
                `Script "${scriptName}" uses wildcard "${prefix}:*" which would match itself, ` +
                `creating potential infinite recursion. Use explicit script names instead.`
              );
            }
          }
        }
      });
    });

    it('should explicitly list scripts instead of using wildcards for critical dev commands', () => {
      const scripts = packageJson.scripts;
      const criticalScripts = ['dev', 'start', 'test:all'];

      criticalScripts.forEach(scriptName => {
        if (scripts[scriptName]) {
          const scriptContent = scripts[scriptName];

          if (scriptContent.includes('npm-run-all') || scriptContent.includes('concurrently')) {
            // If using parallel runners, should not use wildcard for same prefix
            const prefix = scriptName.split(':')[0];
            const wildcardPattern = new RegExp(`${prefix}:\\*`);

            expect(scriptContent).not.toMatch(wildcardPattern);
          }
        }
      });
    });
  });

  describe('concurrently and npm-run-all safety', () => {
    it('should not have concurrently commands that create recursive loops', () => {
      const scripts = packageJson.scripts;

      Object.entries(scripts).forEach(([scriptName, scriptContent]) => {
        if (typeof scriptContent === 'string' && scriptContent.includes('concurrently')) {
          // Extract what concurrently is running
          const npmColonPattern = /npm:(\w+(?::\w+)?)/g;
          const matches = Array.from(scriptContent.matchAll(npmColonPattern));

          matches.forEach(match => {
            const calledScript = match[1];

            // The called script should not be the same as current script
            expect(calledScript).not.toBe(scriptName);

            // The called script should not use a wildcard that matches current script
            if (scripts[calledScript]) {
              const calledScriptContent = scripts[calledScript];
              const prefix = scriptName.split(':')[0];
              const wildcardPattern = new RegExp(`${prefix}:\\*`);

              if (wildcardPattern.test(calledScriptContent)) {
                fail(
                  `Script "${scriptName}" calls "${calledScript}" via concurrently, ` +
                  `but "${calledScript}" uses wildcard that would match "${scriptName}", ` +
                  `creating recursion.`
                );
              }
            }
          });
        }
      });
    });

    it('should not have npm-run-all with patterns that match the calling script', () => {
      const scripts = packageJson.scripts;

      Object.entries(scripts).forEach(([scriptName, scriptContent]) => {
        if (typeof scriptContent === 'string' && scriptContent.includes('npm-run-all')) {
          // Check for wildcard patterns
          const prefix = scriptName.split(':')[0];
          const wildcardPattern = new RegExp(`${prefix}:\\*`);

          if (wildcardPattern.test(scriptContent) && scriptName.startsWith(`${prefix}:`)) {
            fail(
              `Script "${scriptName}" uses npm-run-all with pattern "${prefix}:*" ` +
              `which would match itself and create recursion.`
            );
          }
        }
      });
    });
  });

  describe('respawn flag safety', () => {
    it('should document why --respawn flag is used in scripts', () => {
      const scripts = packageJson.scripts;
      const respawnScripts = Object.entries(scripts).filter(
        ([, content]) => typeof content === 'string' && content.includes('--respawn')
      );

      // Just documenting this for awareness - respawn itself isn't bad,
      // but combined with recursive script calls it's dangerous
      expect(respawnScripts.length).toBeGreaterThan(0);

      respawnScripts.forEach(([scriptName]) => {
        // These scripts use --respawn, so extra vigilance needed
        // to ensure they're not called recursively
        const scriptContent = scripts[scriptName];

        // Should not call itself
        expect(scriptContent).not.toMatch(new RegExp(`npm\\s+run\\s+${scriptName}|npm:${scriptName}`));
      });
    });
  });
});