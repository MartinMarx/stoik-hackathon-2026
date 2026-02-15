import { fetchDirectory, fetchFileContent } from "@/lib/github/client";
import type { CursorStructure } from "@/types";

// ---------------------------------------------------------------------------
// Default boilerplate names that ship with the template and should NOT count
// toward a team's score.
// ---------------------------------------------------------------------------
const DEFAULT_RULES = new Set(["project-standards", "typescript-conventions", "team-context"]);
const DEFAULT_SKILLS = new Set(["game-rules", "setup"]);
const DEFAULT_COMMANDS = new Set(["setup"]);

// ---------------------------------------------------------------------------
// Frontmatter parser – works for both .mdc and .md files that follow the
// ---\nkey: value\n--- convention.
// ---------------------------------------------------------------------------
export function parseFrontmatter(content: string): { metadata: Record<string, string>; body: string } {
  const metadata: Record<string, string> = {};

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { metadata, body: content };
  }

  const [, frontmatterBlock, body] = match;

  for (const line of frontmatterBlock.split(/\r?\n/)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key) {
      metadata[key] = value;
    }
  }

  return { metadata, body };
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------
export async function analyzeCursorStructure(
  owner: string,
  repo: string,
): Promise<CursorStructure> {
  const [rules, skills, commands, hooks] = await Promise.all([
    fetchRules(owner, repo),
    fetchSkills(owner, repo),
    fetchCommands(owner, repo),
    fetchHooks(owner, repo),
  ]);

  const rulesCount = rules.filter((r) => !DEFAULT_RULES.has(r.name)).length;
  const skillsCount = skills.filter((s) => !DEFAULT_SKILLS.has(s.name)).length;
  const commandsCount = commands.filter((c) => !DEFAULT_COMMANDS.has(c.name)).length;

  return {
    rules,
    skills,
    commands,
    hooks,
    rulesCount,
    skillsCount,
    commandsCount,
  };
}

// ---------------------------------------------------------------------------
// Rules – .cursor/rules/*.mdc
// ---------------------------------------------------------------------------
async function fetchRules(
  owner: string,
  repo: string,
): Promise<CursorStructure["rules"]> {
  const entries = await fetchDirectory(owner, repo, ".cursor/rules");
  const mdcFiles = entries.filter((e) => e.name.endsWith(".mdc"));

  const results = await Promise.all(
    mdcFiles.map(async (entry) => {
      try {
        const raw = await fetchFileContent(owner, repo, entry.path);
        if (!raw) return null;

        const { metadata, body } = parseFrontmatter(raw);
        const nameFromFile = entry.name.replace(/\.mdc$/, "");

        return {
          name: metadata.name || nameFromFile,
          glob: metadata.glob || "",
          content: raw,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// ---------------------------------------------------------------------------
// Skills – .cursor/skills/<dir>/SKILL.md
// ---------------------------------------------------------------------------
async function fetchSkills(
  owner: string,
  repo: string,
): Promise<CursorStructure["skills"]> {
  const entries = await fetchDirectory(owner, repo, ".cursor/skills");
  const dirs = entries.filter((e) => e.type === "dir");

  const results = await Promise.all(
    dirs.map(async (dir) => {
      try {
        const raw = await fetchFileContent(owner, repo, `${dir.path}/SKILL.md`);
        if (!raw) return null;

        const { metadata, body } = parseFrontmatter(raw);
        const nameFromDir = dir.name;

        return {
          name: metadata.name || nameFromDir,
          description: metadata.description || "",
          contentLength: body.length,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// ---------------------------------------------------------------------------
// Commands – .cursor/commands/*.md
// ---------------------------------------------------------------------------
async function fetchCommands(
  owner: string,
  repo: string,
): Promise<CursorStructure["commands"]> {
  const entries = await fetchDirectory(owner, repo, ".cursor/commands");
  const mdFiles = entries.filter((e) => e.name.endsWith(".md"));

  const results = await Promise.all(
    mdFiles.map(async (entry) => {
      try {
        const raw = await fetchFileContent(owner, repo, entry.path);
        if (!raw) return null;

        const { metadata } = parseFrontmatter(raw);
        const nameFromFile = entry.name.replace(/\.md$/, "");

        return {
          name: metadata.name || nameFromFile,
          description: metadata.description || "",
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// ---------------------------------------------------------------------------
// Hooks – .cursor/hooks.json
// Expected shape: { hooks: { [eventName: string]: { command: string }[] } }
// ---------------------------------------------------------------------------
async function fetchHooks(
  owner: string,
  repo: string,
): Promise<CursorStructure["hooks"]> {
  try {
    const raw = await fetchFileContent(owner, repo, ".cursor/hooks.json");
    if (!raw) return [];

    const parsed = JSON.parse(raw) as {
      hooks?: Record<string, { command: string }[]>;
    };

    if (!parsed.hooks || typeof parsed.hooks !== "object") return [];

    const results: CursorStructure["hooks"] = [];

    for (const [event, handlers] of Object.entries(parsed.hooks)) {
      if (!Array.isArray(handlers)) continue;
      for (const handler of handlers) {
        if (handler && typeof handler.command === "string") {
          results.push({ event, command: handler.command });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}
