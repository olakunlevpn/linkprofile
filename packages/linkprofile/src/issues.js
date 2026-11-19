const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export class BuildError extends Error {
  constructor(issues) {
    const first = issues.find((i) => i.level === 'error') ?? issues[0];
    super(first ? first.message : 'Build failed');
    this.name = 'BuildError';
    this.issues = issues;
  }
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function formatIssues(issues, { color = false } = {}) {
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text);
  const sorted = [
    ...issues.filter((i) => i.level === 'error'),
    ...issues.filter((i) => i.level !== 'error'),
  ];
  const blocks = sorted.map((issue) => {
    const isError = issue.level === 'error';
    const label = paint(isError ? RED : YELLOW, isError ? 'error' : 'warning');
    const lines = [];
    let head = label + ': ';
    if (issue.file) {
      head += issue.file;
      if (issue.line != null) head += `:${issue.line}`;
      if (issue.line != null && issue.column != null) head += `:${issue.column}`;
      head += ': ';
    }
    if (issue.path) head += `${issue.path}: `;
    lines.push(head + issue.message);
    if (issue.sourceLine != null) {
      lines.push(`  ${issue.sourceLine}`);
      if (issue.column != null) lines.push(`  ${' '.repeat(Math.max(0, issue.column - 1))}${paint(isError ? RED : YELLOW, '^')}`);
    }
    if (issue.hint) lines.push(`  Hint: ${issue.hint}`);
    return lines.join('\n');
  });
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;
  blocks.push(paint(DIM, `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`));
  return blocks.join('\n\n');
}
