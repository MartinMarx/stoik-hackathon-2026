export interface SubstanceMetrics {
  totalFiles: number;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  commentToCodeRatio: number;
  averageFileSize: number;
  emptyFileCount: number;
  suspiciousFileCount: number;
  suspiciousFiles: string[];
}

const COMMENT_PATTERNS: Record<string, RegExp[]> = {
  line: [/^\s*\/\//, /^\s*#(?!!)/, /^\s*\*/, /^\s*<!--/],
  blockStart: [/^\s*\/\*/, /^\s*{\/\*/],
  blockEnd: [/\*\/\s*$/, /\*\/}\s*$/],
};

const MIN_CODE_LINES_PER_FILE = 5;
const SUSPICIOUS_COMMENT_RATIO = 0.6;

/**
 * Analyze source files to produce substance metrics — a cheap static check
 * that serves as a reality anchor for AI review results.
 */
export function analyzeCodeSubstance(
  files: { path: string; content: string }[],
): SubstanceMetrics {
  let totalLines = 0;
  let codeLines = 0;
  let commentLines = 0;
  let blankLines = 0;
  let emptyFileCount = 0;
  const suspiciousFiles: string[] = [];

  for (const file of files) {
    const lines = file.content.split("\n");
    const stats = classifyLines(lines);

    totalLines += stats.total;
    codeLines += stats.code;
    commentLines += stats.comment;
    blankLines += stats.blank;

    if (stats.code < MIN_CODE_LINES_PER_FILE) {
      emptyFileCount++;
    }

    // File is suspicious if it's mostly comments/strings relative to code
    if (
      stats.total > 10 &&
      stats.code > 0 &&
      stats.comment / stats.code > SUSPICIOUS_COMMENT_RATIO
    ) {
      suspiciousFiles.push(file.path);
    }

    // Also suspicious: very large file with very little code
    if (stats.total > 50 && stats.code < 10) {
      if (!suspiciousFiles.includes(file.path)) {
        suspiciousFiles.push(file.path);
      }
    }
  }

  return {
    totalFiles: files.length,
    totalLines,
    codeLines,
    commentLines,
    blankLines,
    commentToCodeRatio: codeLines > 0 ? commentLines / codeLines : 0,
    averageFileSize: files.length > 0 ? totalLines / files.length : 0,
    emptyFileCount,
    suspiciousFileCount: suspiciousFiles.length,
    suspiciousFiles: suspiciousFiles.slice(0, 20),
  };
}

function classifyLines(lines: string[]) {
  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blank++;
      continue;
    }

    if (inBlockComment) {
      comment++;
      if (COMMENT_PATTERNS.blockEnd.some((p) => p.test(trimmed))) {
        inBlockComment = false;
      }
      continue;
    }

    if (COMMENT_PATTERNS.blockStart.some((p) => p.test(trimmed))) {
      comment++;
      if (!COMMENT_PATTERNS.blockEnd.some((p) => p.test(trimmed))) {
        inBlockComment = true;
      }
      continue;
    }

    if (COMMENT_PATTERNS.line.some((p) => p.test(trimmed))) {
      comment++;
      continue;
    }

    code++;
  }

  return { total: lines.length, code, comment, blank };
}
