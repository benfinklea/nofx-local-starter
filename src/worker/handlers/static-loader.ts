/**
 * Static handler loader for serverless environments (Vercel)
 * Imports all handlers at build time so they get bundled properly
 */
import type { StepHandler } from './types';

// Import all handlers statically
import bash from './bash';
import codegen from './codegen';
import codegenV2 from './codegen_v2';
import dbWrite from './db_write';
import gate from './gate';
import gitOps from './git_ops';
import gitPr from './git_pr';
import manual from './manual';
import projectInit from './project_init';
import testEcho from './test_echo';
import testFail from './test_fail';

/**
 * Returns all handlers bundled at build time
 * This avoids dynamic require() calls that don't work in Vercel serverless
 */
export function loadHandlers(): StepHandler[] {
  return [
    bash,
    codegen,
    codegenV2,
    dbWrite,
    gate,
    gitOps,
    gitPr,
    manual,
    projectInit,
    testEcho,
    testFail,
  ];
}
