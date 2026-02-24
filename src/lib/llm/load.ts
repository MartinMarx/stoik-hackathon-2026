import { readFileSync } from "fs";
import { join } from "path";

const LLM_DIR = join(process.cwd(), "src", "lib", "llm");

const ALLOWED = new Set([
  "chunk-review",
  "synthesis",
  "incremental-review",
  "feature-compliance",
  "slack-polish",
  "features-assist",
  "agentic-quality",
  "achievement-enhance",
]);

const cache: Record<string, string> = {};

export function loadPrompt(name: string, vars: Record<string, string>): string {
  if (!ALLOWED.has(name)) {
    throw new Error(`Unknown prompt: ${name}`);
  }
  if (!cache[name]) {
    const path = join(LLM_DIR, name, "prompt.md");
    cache[name] = readFileSync(path, "utf-8");
  }
  let out = cache[name];
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, "g"), v ?? "");
  }
  return out;
}
