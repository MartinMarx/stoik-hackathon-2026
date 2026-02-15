# Hackathon Admin Dashboard - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js admin dashboard to track, score, and gamify a 30-hour hackathon where 4-6 teams build "Among Us for Coders" using Cursor.

**Architecture:** Monolith Next.js 16 (App Router) deployed on Vercel. Drizzle ORM with Neon PostgreSQL for persistence. GitHub webhooks trigger AI analysis (Claude Opus 4.6) with 2-min debounce per team. Slack notifications for achievements and feature announcements. Admin + public live view.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, Neon, shadcn/ui, Tailwind CSS, Recharts, Octokit, @slack/web-api, @anthropic-ai/sdk

**Design doc:** `docs/plans/2026-02-15-hackathon-admin-design.md`

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `drizzle.config.ts`, `.env.example`, `.gitignore`, `tailwind.config.ts` (if needed by v4)
- Create: `src/app/layout.tsx`, `src/app/globals.css`

**Step 1: Initialize Next.js project**

```bash
cd /Users/martinmarx/www/stoik/hackathon-2026/admin-2
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --turbopack
```

Accept defaults. If it asks about overwriting, allow it (the directory only has docs/ and .git/).

**Step 2: Install core dependencies**

```bash
npm install drizzle-orm @neondatabase/serverless @anthropic-ai/sdk octokit @slack/web-api zod recharts lucide-react next-themes sonner framer-motion
npm install -D drizzle-kit
```

**Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: New York style, Zinc color, CSS variables. Then add core components:

```bash
npx shadcn@latest add button card badge input textarea select dialog sheet table tabs separator skeleton tooltip avatar dropdown-menu progress
```

**Step 4: Create `.env.example`**

```env
DATABASE_URL=
GITHUB_TOKEN=
GITHUB_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=
HACKATHON_START=2026-03-01T09:00:00Z
```

**Step 5: Create `.gitignore`**

Ensure `.env` and `.env.local` are in `.gitignore` (create-next-app should handle this).

**Step 6: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 7: Add db scripts to `package.json`**

Add to scripts:
```json
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio",
"db:generate": "drizzle-kit generate"
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: Database Schema

**Files:**
- Create: `src/lib/db/index.ts`
- Create: `src/lib/db/schema.ts`

**Step 1: Create database client**

Create `src/lib/db/index.ts`:

```typescript
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**Step 2: Create full schema**

Create `src/lib/db/schema.ts` with all 8 tables from the design doc:

- `teams` - id, name (unique), repo_url, repo_owner, repo_name, created_at
- `features` - id, title, description, criteria (jsonb string[]), points, difficulty (text), status (text), created_at, announced_at, announced_by
- `analyses` - id, team_id (FK), triggered_by, commit_sha, status (text), result (jsonb), started_at, completed_at, created_at
- `cursor_metrics` - id, team_id (FK), analysis_id (FK), all metric columns from design, raw_stats (jsonb), created_at
- `achievements` - id, team_id (FK), achievement_id (text), unlocked_at, data (jsonb), notified (boolean default false)
- `events` - id, team_id (FK), type (text), data (jsonb), points (int nullable), created_at
- `scores` - id, team_id (FK), breakdown (jsonb), total (int), recorded_at
- `feature_completions` - team_id + feature_id composite PK, status (text), confidence (real), details (text nullable), updated_at

Use `uuid` PKs with `defaultRandom()`, `timestamp` with timezone, and `text` for enums (simpler with Drizzle).

**Step 3: Push schema to Neon**

```bash
npx drizzle-kit push
```

Verify tables are created (use `npx drizzle-kit studio` to check).

**Step 4: Commit**

```bash
git add src/lib/db/
git commit -m "feat: add database schema with Drizzle ORM"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

**Step 1: Define all shared types**

Create `src/types/index.ts` with:

```typescript
// Achievement system
export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export type AchievementCategory =
  | "implementation" | "git" | "agentic" | "cursor-usage"
  | "code-quality" | "design" | "collaboration" | "speed"
  | "features" | "fun";

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  category: AchievementCategory;
}

export interface UnlockedAchievement extends AchievementDefinition {
  unlockedAt: string;
  data?: Record<string, unknown>;
}

// Scoring
export interface ScoreBreakdown {
  implementation: { total: number; rulesComplete: number; rulesPartial: number; creative: number };
  agentic: { total: number; rules: number; skills: number; commands: number };
  codeQuality: { total: number; typescript: number; tests: number; structure: number };
  gitActivity: { total: number; commits: number; contributors: number; regularity: number };
  cursorUsage: { total: number; prompts: number; toolDiversity: number; sessions: number; models: number };
  bonusFeatures?: { total: number; implemented: number; announced: number };
}

// Analysis results
export interface AIReviewResult {
  rulesImplemented: { rule: string; status: "complete" | "partial" | "missing"; confidence: number; details?: string }[];
  codeQualityScore: number;
  bugs: { file: string; line?: number; description: string; severity: "low" | "medium" | "high" }[];
  bonusFeatures: string[];
  uxScore: number;
  recommendations: string[];
}

export interface CursorStructure {
  rules: { name: string; glob: string; content: string }[];
  skills: { name: string; description: string; contentLength: number }[];
  commands: { name: string; description: string }[];
  hooks: { event: string; command: string }[];
  rulesCount: number;
  skillsCount: number;
  commandsCount: number;
}

export interface CursorMetricsData {
  totalPrompts: number;
  totalToolUses: number;
  toolUseBreakdown: Record<string, number>;
  totalSessions: number;
  modelsUsed: string[];
  agentThoughtsCount: number;
  fileEditsCount: number;
  shellExecutionsCount: number;
  mcpExecutionsCount: number;
  avgResponseTimeMs: number;
  totalEvents: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface GitMetrics {
  commits: GitCommit[];
  totalCommits: number;
  authors: string[];
  additions: number;
  deletions: number;
  filesChanged: string[];
  commitsByHour: Record<number, number>;
  firstCommitAt?: string;
  lastCommitAt?: string;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  email: string;
  date: string;
  additions: number;
  deletions: number;
  files: string[];
}

export interface TeamAnalysis {
  team: string;
  teamId: string;
  analyzedAt: string;
  commitSha: string;
  cursor: CursorStructure;
  cursorMetrics: CursorMetricsData;
  git: GitMetrics;
  aiReview: AIReviewResult;
  featuresCompliance: FeatureComplianceResult[];
  score: ScoreBreakdown;
  totalScore: number;
  achievements: UnlockedAchievement[];
  recommendations: string[];
}

export interface FeatureComplianceResult {
  featureId: string;
  featureTitle: string;
  status: "implemented" | "partial" | "missing";
  confidence: number;
  details?: string;
}

export interface LeaderboardEntry {
  rank: number;
  team: string;
  teamId: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  achievements: UnlockedAchievement[];
  trend: "up" | "down" | "stable";
  previousRank?: number;
}

export interface HackathonFeature {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  points: number;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "announced" | "archived";
  createdAt: string;
  announcedAt?: string;
  announcedBy?: string;
}

export interface TimelineEvent {
  id: string;
  teamId: string;
  teamName: string;
  type: "commit" | "achievement" | "feature_completed" | "analysis" | "score_change";
  data: Record<string, unknown>;
  points: number | null;
  createdAt: string;
}
```

**Step 2: Commit**

```bash
git add src/types/
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Achievement Definitions

**Files:**
- Create: `src/lib/achievements/definitions.ts`

**Step 1: Define all 46 achievements**

Create `src/lib/achievements/definitions.ts` with the complete `ACHIEVEMENTS` array matching all achievements from the design doc. Each entry has: `id`, `name`, `description`, `icon` (emoji), `rarity`, `category`.

Group them in the code with comments: Implementation, Git-Commits, Git-Other, Agentic-Rules, Agentic-Skills, Agentic-Commands, Agentic-Other, Cursor-Usage-Events, Cursor-Usage-Prompts, Cursor-Usage-Other, Code-Quality, Design-UX, Collaboration, Speed, Features, Fun.

Also export:
```typescript
export const RARITY_POINTS: Record<AchievementRarity, number> = {
  common: 1, rare: 2, epic: 4, legendary: 6,
};

export function getAchievementById(id: string): AchievementDefinition | undefined;
export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[];
```

**Step 2: Commit**

```bash
git add src/lib/achievements/
git commit -m "feat: add 46 achievement definitions"
```

---

## Task 5: GitHub Client

**Files:**
- Create: `src/lib/github/client.ts`

**Step 1: Create GitHub client**

Create `src/lib/github/client.ts` with functions:

```typescript
import { Octokit } from "octokit";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Fetch file content from a repo (returns decoded string or null if not found)
export async function fetchFileContent(owner: string, repo: string, path: string): Promise<string | null>;

// Fetch directory listing (returns array of {name, path, type})
export async function fetchDirectory(owner: string, repo: string, path: string): Promise<{name: string; path: string; type: string}[]>;

// Fetch all commits (with pagination, returns GitCommit[])
export async function fetchCommits(owner: string, repo: string): Promise<GitCommit[]>;

// Fetch a single commit's stats (additions, deletions, files)
export async function fetchCommitDetail(owner: string, repo: string, sha: string): Promise<{additions: number; deletions: number; files: string[]}>;

// Fetch contributors
export async function fetchContributors(owner: string, repo: string): Promise<{login: string; contributions: number; avatarUrl: string}[]>;

// Fetch package.json dependencies
export async function fetchPackageJson(owner: string, repo: string): Promise<{dependencies: Record<string, string>; devDependencies: Record<string, string>} | null>;

// Fetch all source files content (for AI analysis) - fetches src/ and app/ recursively, returns concatenated content with file paths
export async function fetchSourceCode(owner: string, repo: string): Promise<{path: string; content: string}[]>;
```

Implement with proper error handling (404 = null, rate limiting awareness).

**Step 2: Commit**

```bash
git add src/lib/github/
git commit -m "feat: add GitHub client with Octokit"
```

---

## Task 6: Cursor Analytics Parser (events.jsonl)

**Files:**
- Create: `src/lib/analyzers/cursor-events.ts`

**Step 1: Write the events.jsonl parser**

Create `src/lib/analyzers/cursor-events.ts`:

This function takes the raw `events.jsonl` string content (fetched from the team's repo via GitHub API) and parses it into `CursorMetricsData`.

```typescript
export function parseCursorEvents(eventsJsonl: string): CursorMetricsData;
```

Implementation:
- Split by newlines, parse each line as JSON
- Count events by `event` field (beforeSubmitPrompt = prompt, preToolUse/postToolUse = tool use, afterFileEdit = file edit, etc.)
- Extract unique `conversation_id` values = sessions
- Extract unique `model` values = models used
- Count `afterAgentThought` = agent thoughts
- Count `beforeShellExecution` / `afterShellExecution` = shell executions
- Count `beforeMCPExecution` / `afterMCPExecution` = MCP executions
- For tool uses, build a breakdown by `data.tool_name`
- Calculate avg response time from `duration_ms` in `afterAgentThought` events
- Extract first/last event timestamps
- Handle malformed lines gracefully (skip with warning)

**Step 2: Commit**

```bash
git add src/lib/analyzers/cursor-events.ts
git commit -m "feat: add Cursor events.jsonl parser"
```

---

## Task 7: Cursor Structure Analyzer

**Files:**
- Create: `src/lib/analyzers/cursor-structure.ts`

**Step 1: Write the Cursor structure analyzer**

Create `src/lib/analyzers/cursor-structure.ts`:

```typescript
import { fetchDirectory, fetchFileContent } from "@/lib/github/client";
import type { CursorStructure } from "@/types";

export async function analyzeCursorStructure(owner: string, repo: string): Promise<CursorStructure>;
```

Implementation:
- Fetch `.cursor/rules/` directory -> list all `.mdc` files -> fetch each -> extract name, glob pattern, content
- Fetch `.cursor/skills/` directory -> list subdirectories -> fetch `SKILL.md` in each -> extract name, description, content length
- Fetch `.cursor/commands/` directory -> list all `.md` files -> fetch each -> extract name, description
- Fetch `.cursor/hooks.json` if it exists -> parse hook definitions
- Count each category (exclude defaults from boilerplate: `project-standards.mdc`, `typescript-conventions.mdc`, `team-context.mdc`, `game-rules`, `setup.md`)
- Return `CursorStructure` with counts and details

**Step 2: Commit**

```bash
git add src/lib/analyzers/cursor-structure.ts
git commit -m "feat: add Cursor structure analyzer"
```

---

## Task 8: Git Analyzer

**Files:**
- Create: `src/lib/analyzers/git.ts`

**Step 1: Write the Git analyzer**

Create `src/lib/analyzers/git.ts`:

```typescript
import { fetchCommits, fetchCommitDetail, fetchContributors } from "@/lib/github/client";
import type { GitMetrics } from "@/types";

export async function analyzeGit(owner: string, repo: string): Promise<GitMetrics>;
```

Implementation:
- Fetch all commits via GitHub API
- For each commit, get additions/deletions/files (batch the detail calls, limit concurrency to 5)
- Build commits-by-hour distribution
- Compute total additions, deletions, unique files changed
- Extract unique authors
- Find first/last commit timestamps

Also export helper:
```typescript
export function getCommitRegularity(commits: GitCommit[]): number; // 0-1 score based on time distribution
```

**Step 2: Commit**

```bash
git add src/lib/analyzers/git.ts
git commit -m "feat: add Git analyzer"
```

---

## Task 9: AI Code Reviewer (Claude Opus 4.6)

**Files:**
- Create: `src/lib/analyzers/ai-reviewer.ts`

**Step 1: Write the AI reviewer**

Create `src/lib/analyzers/ai-reviewer.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { AIReviewResult, HackathonFeature } from "@/types";

const anthropic = new Anthropic();

export async function reviewCode(
  sourceFiles: { path: string; content: string }[],
  packageJson: { dependencies: Record<string, string>; devDependencies: Record<string, string> } | null,
  gameRules: string,
  bonusFeatures: HackathonFeature[],
): Promise<AIReviewResult>;
```

Implementation:
- Build a structured prompt with:
  - The game rules (from `rules.md` or hardcoded)
  - The bonus features to check
  - All source code (concatenated with file paths)
  - `package.json` dependencies
- Ask Claude Opus 4.6 to evaluate:
  - Which game rules are implemented (complete/partial/missing with confidence 0-1)
  - Code quality score (0-15)
  - Bugs found (file, line, description, severity)
  - Bonus features detected
  - UX/design score (0-10)
  - Recommendations
- Parse the structured JSON response (use tool_use / JSON mode for reliable parsing)
- Return `AIReviewResult`

The prompt should reference the game rules from `rules.md`:
- Lobby system (create/join)
- Role assignment (civilians + 1 impostor)
- Coding phase (TODOs, tests)
- Civilian behavior (fix code, watch others)
- Impostor behavior (subtle sabotage)
- Emergency meetings (call, discuss, vote)
- Win conditions (tests pass / impostor voted out / sabotage complete / time out)

**Step 2: Commit**

```bash
git add src/lib/analyzers/ai-reviewer.ts
git commit -m "feat: add AI code reviewer with Claude Opus 4.6"
```

---

## Task 10: Scoring Engine

**Files:**
- Create: `src/lib/scoring/engine.ts`
- Create: `src/lib/scoring/__tests__/engine.test.ts`

**Step 1: Write tests for the scoring engine**

Create `src/lib/scoring/__tests__/engine.test.ts` with test cases:
- `scoreImplementation` returns 0 when no AI review
- `scoreImplementation` scores correctly with mix of complete/partial/missing
- `scoreAgentic` scores rules/skills/commands proportionally
- `scoreCursorUsage` scores events.jsonl metrics
- `scoreGitActivity` handles edge cases (0 commits, 1 author)
- `calculateTotalScore` sums all categories correctly
- Max scores don't exceed category caps (35, 25, 15, 10, 15)

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/scoring/__tests__/engine.test.ts
```

Note: You may need to install vitest first: `npm install -D vitest @vitejs/plugin-react`.

**Step 3: Implement the scoring engine**

Create `src/lib/scoring/engine.ts`:

```typescript
import type { ScoreBreakdown, CursorStructure, CursorMetricsData, GitMetrics, AIReviewResult, FeatureComplianceResult, HackathonFeature } from "@/types";

const MAX = { implementation: 35, agentic: 25, codeQuality: 15, gitActivity: 10, cursorUsage: 15 };

export function calculateScore(
  cursor: CursorStructure,
  cursorMetrics: CursorMetricsData,
  git: GitMetrics,
  aiReview: AIReviewResult,
  featuresCompliance?: FeatureComplianceResult[],
  features?: HackathonFeature[],
): ScoreBreakdown;

export function getTotalScore(breakdown: ScoreBreakdown): number;
export function getMaxPossibleScore(features?: HackathonFeature[]): number;
```

Scoring logic:

**Implementation (max 35)**:
- Count complete rules: each = 25/totalRules pts
- Count partial rules: each = (25/totalRules) * 0.5 pts
- Creative features: min(10, bonusFeatures.length * 2 + uxScore)

**Agentic (max 25)**:
- Rules: min(10, rulesCount * 2.5) (cap: 4 rules = 10pts)
- Skills: min(10, skillsCount * 2.5 + (hasLongSkill ? 2 : 0))
- Commands: min(5, commandsCount * 2)

**Code Quality (max 15)**:
- From AI review: codeQualityScore (0-15, directly from Claude)

**Git Activity (max 10)**:
- Commits: min(4, floor(totalCommits / 15))
- Contributors: min(3, authors.length)
- Regularity: round(regularity * 3)

**Cursor Usage (max 15)**:
- Prompts: min(4, floor(totalPrompts / 50))
- Tool diversity: min(3, uniqueToolTypes / 2)
- Sessions: min(3, totalSessions)
- Models: min(2, modelsUsed.length)
- MCP bonus: mcpExecutionsCount > 0 ? 3 : 0

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/scoring/__tests__/engine.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/scoring/
git commit -m "feat: add scoring engine with tests"
```

---

## Task 11: Achievement Engine

**Files:**
- Create: `src/lib/achievements/engine.ts`
- Create: `src/lib/achievements/__tests__/engine.test.ts`

**Step 1: Write tests for the achievement engine**

Test key achievement evaluations:
- Commit count badges trigger at correct thresholds (20, 60, 120, 200)
- Rule/skill/command multi-level badges
- "clean-history" detects messy commit messages
- "poet" checks all commits have emoji
- "full-squad" requires 4+ contributors with 3+ commits each
- Higher-level badges include lower-level (if you have 60 commits, you get both "active" and "commit-machine")

**Step 2: Run tests to verify they fail**

**Step 3: Implement the achievement engine**

Create `src/lib/achievements/engine.ts`:

```typescript
import type { CursorStructure, CursorMetricsData, GitMetrics, AIReviewResult, FeatureComplianceResult, ScoreBreakdown } from "@/types";
import { ACHIEVEMENTS, RARITY_POINTS } from "./definitions";

export interface AchievementEvalContext {
  cursor: CursorStructure;
  cursorMetrics: CursorMetricsData;
  git: GitMetrics;
  aiReview: AIReviewResult;
  score: ScoreBreakdown;
  featuresCompliance: FeatureComplianceResult[];
  previouslyUnlocked: string[]; // achievement IDs already earned
  allTeamsData?: { teamId: string; featuresImplemented: number; featurePoints: number }[]; // for relative achievements
  hackathonStartTime?: string;
}

export function evaluateAchievements(ctx: AchievementEvalContext): { id: string; data?: Record<string, unknown> }[];
```

Implement each achievement check as a function. For each achievement ID, write a checker function:

- **Threshold-based** (commits, events, prompts, rules, skills, commands): simple `>= N` checks
- **Pattern-based** (clean-history, poet): regex on commit messages
- **Relative** (feature-hunter, point-machine): compare against `allTeamsData`
- **Time-based** (quick-start, marathon-runner): compute from commit timestamps
- **AI-based** (first-blood, game-on, full-house, masterpiece, zero-bug, eye-candy): derived from `aiReview` fields
- **Package.json-based** (overkill, minimalist, pixel-perfect): count dependencies
- **Manual** (easter-egg-hunter): skip in automated evaluation

Filter out `previouslyUnlocked` to only return newly earned achievements.

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add src/lib/achievements/
git commit -m "feat: add achievement engine with tests"
```

---

## Task 12: Slack Client

**Files:**
- Create: `src/lib/slack/client.ts`

**Step 1: Create Slack client with all message types**

Create `src/lib/slack/client.ts`:

```typescript
import { WebClient } from "@slack/web-api";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const channel = process.env.SLACK_CHANNEL_ID!;

// Announce a new bonus feature
export async function announceFeature(feature: HackathonFeature): Promise<void>;

// Announce an achievement unlocked by a team
export async function announceAchievement(teamName: string, achievement: AchievementDefinition, details?: string): Promise<void>;

// Send leaderboard summary
export async function sendLeaderboard(entries: LeaderboardEntry[], maxScore: number): Promise<void>;
```

Use Slack Block Kit for rich formatting:
- Feature announcement: header with title, section with description, fields for points/difficulty, divider
- Achievement: context with team name + icon + achievement name + rarity, section with description
- Leaderboard: numbered list with scores, bars showing progress

**Step 2: Commit**

```bash
git add src/lib/slack/
git commit -m "feat: add Slack client with Block Kit messages"
```

---

## Task 13: Analysis Pipeline Orchestrator

**Files:**
- Create: `src/lib/analysis/pipeline.ts`

**Step 1: Create the main analysis pipeline**

Create `src/lib/analysis/pipeline.ts`:

```typescript
import { db } from "@/lib/db";
import type { TeamAnalysis } from "@/types";

// Run a full analysis for one team
export async function runAnalysis(teamId: string, triggeredBy: "webhook" | "manual"): Promise<TeamAnalysis>;
```

Implementation orchestrates all steps:

1. Look up team in DB (get repo_owner, repo_name)
2. Create/update `analyses` record with status `running`
3. In parallel where possible:
   - `fetchSourceCode` + `fetchPackageJson` (for AI review)
   - `analyzeCursorStructure` (rules/skills/commands)
   - `fetchFileContent` for `.cursor/.analytics/events.jsonl` -> `parseCursorEvents`
   - `analyzeGit` (commits, contributors)
4. Wait for all fetches, then call `reviewCode` with Claude Opus 4.6
5. Fetch all announced features from DB
6. Call `calculateScore`
7. Call `evaluateAchievements`
8. Persist to DB in a transaction:
   - Update `analyses` record (status=completed, result=full analysis)
   - Insert `cursor_metrics`
   - Insert `scores` snapshot
   - Insert new `achievements` (not previously unlocked)
   - Upsert `feature_completions`
   - Insert `events` for new achievements, score changes, feature completions
9. Notify Slack for new achievements (call `announceAchievement` for each)
10. Update `analyses` status to `completed`
11. Return full `TeamAnalysis`

Error handling: if any step fails, update `analyses` to `failed` with error in result.

**Step 2: Commit**

```bash
git add src/lib/analysis/
git commit -m "feat: add analysis pipeline orchestrator"
```

---

## Task 14: GitHub Webhook API Route

**Files:**
- Create: `src/app/api/webhooks/github/route.ts`

**Step 1: Create webhook handler with HMAC verification and debounce**

```typescript
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { teams, analyses } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { runAnalysis } from "@/lib/analysis/pipeline";

export async function POST(req: NextRequest) {
  // 1. Verify HMAC signature
  const signature = req.headers.get("x-hub-signature-256");
  const body = await req.text();
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET!).update(body).digest("hex");
  if (signature !== expected) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  // 2. Parse payload
  const payload = JSON.parse(body);
  const event = req.headers.get("x-github-event");
  if (event !== "push") return NextResponse.json({ ok: true, skipped: true });

  // 3. Identify team
  const repoFullName = payload.repository.full_name; // "owner/repo"
  const [owner, repo] = repoFullName.split("/");
  const team = await db.query.teams.findFirst({ where: and(eq(teams.repoOwner, owner), eq(teams.repoName, repo)) });
  if (!team) return NextResponse.json({ error: "Unknown team repo" }, { status: 404 });

  // 4. Debounce: check for pending analysis in last 2 min
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
  const pending = await db.query.analyses.findFirst({
    where: and(eq(analyses.teamId, team.id), eq(analyses.status, "pending"), gte(analyses.createdAt, twoMinAgo)),
  });

  if (pending) {
    // Update existing pending with new SHA
    await db.update(analyses).set({ commitSha: payload.after }).where(eq(analyses.id, pending.id));
  } else {
    // Create new pending
    await db.insert(analyses).values({ teamId: team.id, triggeredBy: "webhook", commitSha: payload.after, status: "pending" });
  }

  // 5. Schedule analysis after debounce (use waitUntil if available, otherwise setTimeout)
  // Using Next.js waitUntil for background execution
  const { waitUntil } = await import("next/server");
  // Note: waitUntil is available in Next.js edge/server context on Vercel
  // Fallback: use setTimeout for local dev
  setTimeout(async () => {
    // Check if still pending (hasn't been superseded)
    const current = await db.query.analyses.findFirst({
      where: and(eq(analyses.teamId, team.id), eq(analyses.status, "pending")),
      orderBy: (a, { desc }) => desc(a.createdAt),
    });
    if (current) {
      await runAnalysis(team.id, "webhook");
    }
  }, 2 * 60 * 1000); // 2 min debounce

  return NextResponse.json({ ok: true, team: team.name, debounced: !!pending });
}
```

**Step 2: Commit**

```bash
git add src/app/api/webhooks/
git commit -m "feat: add GitHub webhook handler with debounce"
```

---

## Task 15: Teams API Routes

**Files:**
- Create: `src/app/api/teams/route.ts`

**Step 1: Create teams CRUD API**

```typescript
// GET /api/teams - List all teams with latest scores
// POST /api/teams - Add a new team { name, repoUrl }
// DELETE /api/teams?id=xxx - Remove a team
```

The POST handler should parse `repoUrl` to extract `repoOwner` and `repoName` (e.g., `https://github.com/org/repo` -> owner=org, name=repo).

**Step 2: Commit**

```bash
git add src/app/api/teams/
git commit -m "feat: add teams CRUD API"
```

---

## Task 16: Analysis API Routes

**Files:**
- Create: `src/app/api/analyze/route.ts`
- Create: `src/app/api/analyze/[teamId]/route.ts`

**Step 1: Create analysis trigger endpoints**

```typescript
// POST /api/analyze - Run analysis for all teams
// POST /api/analyze/[teamId] - Run analysis for one team
// GET /api/analyze/[teamId] - Get latest analysis result for a team
```

The POST endpoints trigger `runAnalysis` and return the result. Use `waitUntil` for the long-running Claude call if needed.

**Step 2: Commit**

```bash
git add src/app/api/analyze/
git commit -m "feat: add analysis trigger API routes"
```

---

## Task 17: Features API Routes

**Files:**
- Create: `src/app/api/features/route.ts`
- Create: `src/app/api/features/[id]/route.ts`
- Create: `src/app/api/features/[id]/announce/route.ts`
- Create: `src/app/api/features/assist/route.ts`

**Step 1: Create features CRUD**

```typescript
// GET /api/features - List all features
// POST /api/features - Create a new feature { title, description, points, difficulty }
// PATCH /api/features/[id] - Update a feature
// DELETE /api/features/[id] - Delete a feature
```

**Step 2: Create announce endpoint**

```typescript
// POST /api/features/[id]/announce - Announce feature on Slack, update status to "announced"
```

Calls `announceFeature` from Slack client, sets `announcedAt` and `status = "announced"`.

**Step 3: Create AI assist endpoint**

```typescript
// POST /api/features/assist - AI helps with criteria/points/wording
// Body: { title: string, description: string }
// Returns: { criteria: string[], suggestedPoints: number, polishedDescription: string }
```

Uses Claude to analyze the feature and suggest evaluation criteria, appropriate point value, and polished wording.

**Step 4: Commit**

```bash
git add src/app/api/features/
git commit -m "feat: add features API with Slack announce and AI assist"
```

---

## Task 18: Events/Timeline API

**Files:**
- Create: `src/app/api/events/route.ts`

**Step 1: Create events endpoint**

```typescript
// GET /api/events - Get timeline events (global or per team)
// Query params: ?team=xxx&limit=50&offset=0
```

Returns events sorted by `created_at` DESC with team name joined. Used by the activity feed on the dashboard and team detail page.

**Step 2: Commit**

```bash
git add src/app/api/events/
git commit -m "feat: add events timeline API"
```

---

## Task 19: Leaderboard API

**Files:**
- Create: `src/app/api/leaderboard/route.ts`

**Step 1: Create leaderboard endpoint**

```typescript
// GET /api/leaderboard - Returns ranked list of teams with scores, achievements, trends
```

Implementation:
- Fetch latest score for each team from `scores` table
- Compute rank
- Fetch previous score snapshot to compute trend (up/down/stable)
- Fetch achievements per team
- Return `LeaderboardEntry[]`

**Step 2: Commit**

```bash
git add src/app/api/leaderboard/
git commit -m "feat: add leaderboard API"
```

---

## Task 20: Slack API Route

**Files:**
- Create: `src/app/api/slack/route.ts`

**Step 1: Create Slack message endpoint**

```typescript
// POST /api/slack - Send messages to Slack
// Body: { action: "leaderboard" | "achievement" | "feature", data: ... }
```

Wraps the Slack client functions. Used by the admin dashboard buttons.

**Step 2: Commit**

```bash
git add src/app/api/slack/
git commit -m "feat: add Slack message API route"
```

---

## Task 21: Admin Layout and Navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/nav-header.tsx`

**Step 1: Create the admin layout**

Update `src/app/layout.tsx` with:
- `ThemeProvider` from next-themes (dark/light mode)
- `Toaster` from sonner
- Inter/Geist font

**Step 2: Create sidebar component**

`src/components/sidebar.tsx`:
- Logo / Hackathon title
- Navigation links: Dashboard, Features, Settings
- Team list (links to `/teams/[slug]`)
- Quick action buttons: Refresh All, Send to Slack
- "Live View" link (opens `/live` in new tab)

**Step 3: Create nav header**

`src/components/nav-header.tsx`:
- Page title
- Last updated timestamp
- Refresh button

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/sidebar.tsx src/components/nav-header.tsx
git commit -m "feat: add admin layout with sidebar navigation"
```

---

## Task 22: Dashboard Page (/)

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/components/leaderboard.tsx`
- Create: `src/components/activity-feed.tsx`
- Create: `src/components/features-board.tsx`
- Create: `src/components/score-velocity.tsx`

**Step 1: Create leaderboard component**

`src/components/leaderboard.tsx`:
- Table/card list of teams ranked by score
- Each row: rank (with trend arrow), team name, total score (with progress bar to max), recent badges (last 3 icons)
- Click row -> navigate to `/teams/[slug]`

**Step 2: Create activity feed component**

`src/components/activity-feed.tsx`:
- Vertical timeline of recent events
- Each event: icon (by type), team badge, message, timestamp
- Types: commit (git icon), achievement (trophy), feature_completed (star), analysis (chart), score_change (arrow)
- Auto-refresh via polling every 30s (use `useEffect` + `setInterval` + `fetch`)

**Step 3: Create features board component**

`src/components/features-board.tsx`:
- Grid/list of announced features
- Each: title, points, difficulty badge, completion count (X/Y teams)
- "Announce" button on draft features
- "New Feature" button

**Step 4: Create score velocity graph**

`src/components/score-velocity.tsx`:
- Recharts `LineChart` with one line per team
- X axis: time, Y axis: score
- Data from score snapshots

**Step 5: Assemble dashboard page**

`src/app/page.tsx`:
- Fetch leaderboard, events, features, velocity data
- 2-column grid: Leaderboard + Activity Feed on top, Features Board + Velocity Graph below
- Quick actions bar at top

**Step 6: Commit**

```bash
git add src/app/page.tsx src/components/leaderboard.tsx src/components/activity-feed.tsx src/components/features-board.tsx src/components/score-velocity.tsx
git commit -m "feat: add admin dashboard with leaderboard, activity feed, features, velocity"
```

---

## Task 23: Team Detail Page (/teams/[slug])

**Files:**
- Create: `src/app/teams/[slug]/page.tsx`
- Create: `src/components/score-breakdown.tsx`
- Create: `src/components/achievement-wall.tsx`
- Create: `src/components/cursor-metrics.tsx`
- Create: `src/components/git-stats.tsx`
- Create: `src/components/ai-analysis.tsx`
- Create: `src/components/feature-progress.tsx`
- Create: `src/components/team-timeline.tsx`

**Step 1: Create score breakdown component**

`src/components/score-breakdown.tsx`:
- Radar chart (Recharts) OR horizontal bar chart showing 5 categories
- Each bar: label, score/max, percentage fill
- Color-coded by category

**Step 2: Create achievement wall**

`src/components/achievement-wall.tsx`:
- Grid of all 46 achievements
- Each: icon (emoji), name, rarity border color (common=gray, rare=blue, epic=purple, legendary=gold)
- Unlocked = full color + timestamp, Locked = greyed out + "???" description
- Filter by category tabs

**Step 3: Create Cursor metrics component**

`src/components/cursor-metrics.tsx`:
- Stats cards: total prompts, total events, sessions, models used
- Tool use breakdown (horizontal bar chart)
- MCP usage indicator

**Step 4: Create Git stats component**

`src/components/git-stats.tsx`:
- Stats cards: commits, contributors, additions/deletions
- Commits-by-hour bar chart
- Contributor list with avatars and commit counts

**Step 5: Create AI analysis component**

`src/components/ai-analysis.tsx`:
- Rules implementation table: rule name, status badge (green/yellow/red), confidence bar
- Code quality score
- Bugs list (if any)
- Recommendations list

**Step 6: Create feature progress component**

`src/components/feature-progress.tsx`:
- Table of bonus features: title, points, status badge, confidence, details
- Filter: all / implemented / partial / missing

**Step 7: Create team timeline**

`src/components/team-timeline.tsx`:
- Vertical timeline specific to this team
- Same as activity feed but filtered to one team

**Step 8: Assemble team page**

`src/app/teams/[slug]/page.tsx`:
- Fetch team data, latest analysis, achievements, events
- Header: team name, total score, rank
- Grid layout with all components
- "Run Analysis" button (triggers manual analysis)

**Step 9: Commit**

```bash
git add src/app/teams/ src/components/score-breakdown.tsx src/components/achievement-wall.tsx src/components/cursor-metrics.tsx src/components/git-stats.tsx src/components/ai-analysis.tsx src/components/feature-progress.tsx src/components/team-timeline.tsx
git commit -m "feat: add team detail page with all analysis components"
```

---

## Task 24: Features Management Page (/features)

**Files:**
- Create: `src/app/features/page.tsx`
- Create: `src/components/feature-form.tsx`

**Step 1: Create feature form component**

`src/components/feature-form.tsx`:
- Form with: title (input), description (textarea), difficulty (select), points (input number)
- "Assist with AI" button: sends title+description to `/api/features/assist`, populates criteria and suggested points
- Criteria list: editable tag-like chips (add/remove)
- Save button (calls POST /api/features)

**Step 2: Create features page**

`src/app/features/page.tsx`:
- "New Feature" button (opens dialog with feature form)
- Table of all features: title, description (truncated), points, difficulty, status, completion per team
- Per-row actions: Edit (dialog), Announce on Slack (button), Archive (button)
- Tabs or filter: All / Draft / Announced / Archived

**Step 3: Commit**

```bash
git add src/app/features/ src/components/feature-form.tsx
git commit -m "feat: add feature management page with AI assist"
```

---

## Task 25: Settings Page (/settings)

**Files:**
- Create: `src/app/settings/page.tsx`

**Step 1: Create settings page**

`src/app/settings/page.tsx`:
- **Team Management** section:
  - Add team form: team name + GitHub repo URL
  - List of registered teams with "Remove" button
- **Hackathon Config** section:
  - Start time input (for countdown and time-based achievements)
- **Actions** section:
  - "Analyze All Teams" button
  - "Send Leaderboard to Slack" button
- **Status** section:
  - Show connection status for Slack, GitHub, Anthropic (simple API check)

**Step 2: Commit**

```bash
git add src/app/settings/
git commit -m "feat: add settings page with team management"
```

---

## Task 26: Live Public View (/live)

**Files:**
- Create: `src/app/live/page.tsx`
- Create: `src/app/live/layout.tsx`
- Create: `src/components/live-leaderboard.tsx`
- Create: `src/components/live-achievement-feed.tsx`
- Create: `src/components/countdown.tsx`

**Step 1: Create live layout (no sidebar)**

`src/app/live/layout.tsx`:
- Full-screen layout, no sidebar, no admin nav
- Dark background, large fonts optimized for projection

**Step 2: Create animated leaderboard**

`src/components/live-leaderboard.tsx`:
- Large cards per team, ranked
- Score bar with animated fill
- Rank change animations (framer-motion `AnimatePresence` + `layout` prop)
- Achievement icons row
- Auto-updates via polling

**Step 3: Create live achievement feed**

`src/components/live-achievement-feed.tsx`:
- Large toast-like popups when new achievements are unlocked
- Shows team name + achievement icon + name + rarity glow
- Stays visible for 10s then fades out
- Queue multiple if they arrive simultaneously

**Step 4: Create countdown timer**

`src/components/countdown.tsx`:
- Reads hackathon start time from API (or hardcoded)
- Shows hours:minutes:seconds remaining
- Pulsing animation when < 1 hour left

**Step 5: Assemble live page**

`src/app/live/page.tsx`:
- Split view: leaderboard (left 60%) + achievement feed (right 40%)
- Countdown at top
- Auto-refresh every 15s
- Fullscreen button (uses Fullscreen API) + keyboard shortcut (F key)

**Step 6: Commit**

```bash
git add src/app/live/ src/components/live-leaderboard.tsx src/components/live-achievement-feed.tsx src/components/countdown.tsx
git commit -m "feat: add live public view with animated leaderboard"
```

---

## Task 27: Game Rules Reference

**Files:**
- Create: `src/lib/game-rules.ts`

**Step 1: Embed the game rules**

Create `src/lib/game-rules.ts` with the game rules as a constant string (from `rules.md` in the boilerplate). This is used by the AI reviewer as context for evaluating implementations.

```typescript
export const GAME_RULES = `
# Game Rules - Among Us for Coders
... (full content from rules.md)
`;

export const GAME_RULES_CHECKLIST = [
  { id: "lobby", rule: "Create/join a lobby with 3-5 players" },
  { id: "role-assignment", rule: "Roles assigned secretly (civilians + 1 impostor)" },
  { id: "broken-code", rule: "Match begins with broken TypeScript code and test suite" },
  { id: "civilian-fix", rule: "Civilians can implement missing logic (TODOs)" },
  { id: "civilian-tests", rule: "Civilians can improve correctness so tests pass" },
  { id: "impostor-sabotage", rule: "Impostor introduces subtle harmful changes" },
  { id: "emergency-meeting", rule: "Any player can call an Emergency Meeting" },
  { id: "discussion-vote", rule: "During meetings, players discuss and vote to eject" },
  { id: "win-tests-pass", rule: "Civilians win if all tests pass" },
  { id: "win-impostor-voted", rule: "Civilians win if impostor is voted out" },
  { id: "win-sabotage", rule: "Impostor wins if sabotage tasks completed" },
  { id: "win-timeout", rule: "Impostor wins if they survive until time runs out" },
];
```

**Step 2: Commit**

```bash
git add src/lib/game-rules.ts
git commit -m "feat: embed game rules reference for AI analysis"
```

---

## Task 28: Polish and Integration Testing

**Files:**
- Various existing files

**Step 1: Verify all API routes work**

Start the dev server:
```bash
npm run dev
```

Test each API route manually or with curl:
- `POST /api/teams` - create a test team
- `GET /api/teams` - list teams
- `GET /api/leaderboard` - should return empty or test data
- `GET /api/features` - should return empty
- `POST /api/features` - create a test feature
- `POST /api/features/assist` - test AI assist

**Step 2: Verify webhook flow**

Use a tool like ngrok or Vercel preview to test the webhook:
- Configure a test repo with the webhook
- Push a commit
- Verify analysis is triggered after debounce

**Step 3: Verify live view**

Open `/live` in a browser, check auto-refresh and animations.

**Step 4: Fix any issues found**

**Step 5: Commit**

```bash
git add -A
git commit -m "fix: polish and integration fixes"
```

---

## Task 29: Deploy to Vercel

**Step 1: Create Vercel project**

```bash
npx vercel
```

Link to the project, configure environment variables in Vercel dashboard.

**Step 2: Set environment variables in Vercel**

Add all 7 env vars from `.env.example` in the Vercel project settings.

**Step 3: Push schema to Neon**

```bash
npx drizzle-kit push
```

**Step 4: Deploy**

```bash
npx vercel --prod
```

**Step 5: Configure GitHub webhooks**

For each team repo, add a webhook:
- URL: `https://<your-vercel-url>/api/webhooks/github`
- Content type: `application/json`
- Secret: the value of `GITHUB_WEBHOOK_SECRET`
- Events: Push events only

**Step 6: Commit any deploy-related changes**

```bash
git add -A
git commit -m "chore: deployment configuration"
```

---

## Summary

| Task | Component | Key Files |
|------|-----------|-----------|
| 1 | Project Setup | package.json, configs |
| 2 | Database Schema | src/lib/db/ |
| 3 | TypeScript Types | src/types/ |
| 4 | Achievement Definitions | src/lib/achievements/definitions.ts |
| 5 | GitHub Client | src/lib/github/ |
| 6 | Cursor Events Parser | src/lib/analyzers/cursor-events.ts |
| 7 | Cursor Structure Analyzer | src/lib/analyzers/cursor-structure.ts |
| 8 | Git Analyzer | src/lib/analyzers/git.ts |
| 9 | AI Code Reviewer | src/lib/analyzers/ai-reviewer.ts |
| 10 | Scoring Engine | src/lib/scoring/ |
| 11 | Achievement Engine | src/lib/achievements/engine.ts |
| 12 | Slack Client | src/lib/slack/ |
| 13 | Analysis Pipeline | src/lib/analysis/pipeline.ts |
| 14 | GitHub Webhook | src/app/api/webhooks/ |
| 15 | Teams API | src/app/api/teams/ |
| 16 | Analysis API | src/app/api/analyze/ |
| 17 | Features API | src/app/api/features/ |
| 18 | Events API | src/app/api/events/ |
| 19 | Leaderboard API | src/app/api/leaderboard/ |
| 20 | Slack API | src/app/api/slack/ |
| 21 | Admin Layout | src/app/layout.tsx, src/components/sidebar.tsx |
| 22 | Dashboard Page | src/app/page.tsx + 4 components |
| 23 | Team Detail Page | src/app/teams/[slug]/ + 7 components |
| 24 | Features Page | src/app/features/ + feature-form |
| 25 | Settings Page | src/app/settings/ |
| 26 | Live View | src/app/live/ + 3 components |
| 27 | Game Rules | src/lib/game-rules.ts |
| 28 | Polish & Testing | Various |
| 29 | Deploy | Vercel config |

**Dependency order:** Tasks 1-4 (foundation) -> 5-9 (data fetching/analysis) -> 10-12 (business logic) -> 13 (pipeline) -> 14-20 (API routes) -> 21-26 (UI) -> 27-29 (finish)

Tasks 5-9 can be parallelized. Tasks 14-20 can be parallelized. Tasks 22-26 can be parallelized.
