/**
 * Output Parser - Intelligent JSON parsing for human-readable display
 *
 * Following THE_PHILOSOPHY_OF_NOFX: Business outcomes over technical jargon
 */

export interface ParsedOutput {
  type: 'text' | 'code_changes' | 'structured' | 'unknown';
  summary: string;
  details?: {
    filesModified?: string[];
    linesAdded?: number;
    linesDeleted?: number;
    commitHash?: string;
    repository?: string;
  };
  raw?: any;
}

/**
 * Parse step output intelligently
 */
export function parseStepOutput(output: any): ParsedOutput {
  if (!output) {
    return {
      type: 'unknown',
      summary: 'No output available',
    };
  }

  // If it's already a string, return it
  if (typeof output === 'string') {
    return {
      type: 'text',
      summary: output,
    };
  }

  // Try to extract meaningful content
  const content = extractContent(output);

  // Check if it's code changes
  if (isCodeChanges(output)) {
    return parseCodeChanges(output);
  }

  // Check for common text fields
  if (content) {
    return {
      type: 'text',
      summary: content,
      raw: output,
    };
  }

  // If we have structured data, try to make it readable
  if (typeof output === 'object') {
    const summary = formatStructuredData(output);
    return {
      type: 'structured',
      summary,
      raw: output,
    };
  }

  // Fallback
  return {
    type: 'unknown',
    summary: JSON.stringify(output, null, 2),
    raw: output,
  };
}

/**
 * Extract text content from various output formats
 */
function extractContent(output: any): string | null {
  // Common content fields
  const contentFields = ['content', 'text', 'message', 'result', 'output', 'value'];

  for (const field of contentFields) {
    if (output[field] && typeof output[field] === 'string') {
      return output[field];
    }
    // Handle nested content
    if (output[field] && typeof output[field] === 'object') {
      const nested = extractContent(output[field]);
      if (nested) return nested;
    }
  }

  return null;
}

/**
 * Check if output represents code changes
 */
function isCodeChanges(output: any): boolean {
  if (!output || typeof output !== 'object') return false;

  const codeChangeIndicators = [
    'files', 'filesModified', 'files_modified',
    'changes', 'commits', 'diff',
    'repository', 'repo', 'branch'
  ];

  return codeChangeIndicators.some(indicator => indicator in output);
}

/**
 * Parse code change output
 */
function parseCodeChanges(output: any): ParsedOutput {
  const files = output.files || output.filesModified || output.files_modified || [];
  const repo = output.repository || output.repo || 'repository';
  const commitHash = output.commit || output.commitHash || output.commit_hash;
  const added = output.linesAdded || output.lines_added || 0;
  const deleted = output.linesDeleted || output.lines_deleted || 0;

  let summary = '';

  if (Array.isArray(files) && files.length > 0) {
    summary = `Modified ${files.length} file${files.length > 1 ? 's' : ''} in ${repo}`;

    // Add file details
    const fileActions = files.slice(0, 5).map((f: any) => {
      if (typeof f === 'string') return `→ ${f}`;
      if (f.path) {
        const action = f.action || f.status || 'Modified';
        return `→ ${action}: ${f.path}`;
      }
      return '';
    }).filter(Boolean);

    if (fileActions.length > 0) {
      summary += '\n\n' + fileActions.join('\n');
    }

    if (files.length > 5) {
      summary += `\n... and ${files.length - 5} more`;
    }
  } else {
    summary = `Code changes in ${repo}`;
  }

  if (commitHash) {
    summary += `\n\nCommit: ${commitHash.slice(0, 8)}`;
  }

  return {
    type: 'code_changes',
    summary,
    details: {
      filesModified: Array.isArray(files) ? files.map((f: any) =>
        typeof f === 'string' ? f : f.path || f.name || String(f)
      ) : [],
      linesAdded: added,
      linesDeleted: deleted,
      commitHash,
      repository: repo,
    },
    raw: output,
  };
}

/**
 * Format structured data in a human-readable way
 */
function formatStructuredData(data: any): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    // Skip internal/meta fields
    if (key.startsWith('_') || key === 'raw') continue;

    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    if (value === null || value === undefined) {
      continue;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${label}: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${label}:`);
      value.slice(0, 5).forEach((item, i) => {
        lines.push(`  ${i + 1}. ${formatValue(item)}`);
      });
      if (value.length > 5) {
        lines.push(`  ... and ${value.length - 5} more`);
      }
    } else if (typeof value === 'object') {
      const nested = formatStructuredData(value);
      if (nested) {
        lines.push(`${label}:`);
        nested.split('\n').forEach(line => {
          lines.push(`  ${line}`);
        });
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format a single value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (value.name) return value.name;
    if (value.title) return value.title;
    if (value.label) return value.label;
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Format cost with precision
 */
export function formatCost(cost: number | string | null | undefined): string {
  if (cost === null || cost === undefined) return '$0.00000';

  const numericCost = typeof cost === 'string' ? parseFloat(cost) : cost;

  if (isNaN(numericCost)) return '$0.00000';

  if (numericCost === 0) return '$0.00000 (Free)';

  return `$${numericCost.toFixed(5)}`;
}

/**
 * Get human-friendly duration
 */
export function formatDuration(startTime: string | null | undefined, endTime: string | null | undefined): string {
  if (!startTime || !endTime) return 'Unknown duration';

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMs = end - start;

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
