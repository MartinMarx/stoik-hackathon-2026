/**
 * Paths excluded from every analysis (AI review, structure, etc.).
 * - Exact file: path is excluded if it equals an entry.
 * - Folder: path is excluded if it equals an entry or starts with entry + "/".
 */
export const ANALYSIS_PATH_BLACKLIST = [
  ".cursor/skills/game-rules/SKILL.md",
  ".cursor/.analytics",
  ".cursor/commands/push.md",
  ".cursor/commands/setup.md",
  ".cursor/commands/start.md",
  ".cursor/commands/team-stats.md",
  ".cursor/commands/update.md",
] as const;

export function isBlacklistedPath(path: string): boolean {
  const normalized = path.replace(/\/+/g, "/");
  for (const entry of ANALYSIS_PATH_BLACKLIST) {
    const e = entry.replace(/\/+$/, "");
    if (normalized === e || normalized.startsWith(e + "/")) return true;
  }
  return false;
}
