import { describe, it, expect } from "vitest";
import { evaluateAchievements, AchievementEvalContext } from "../engine";
import type {
  CursorStructure,
  CursorMetricsData,
  GitMetrics,
  GitCommit,
  AIReviewResult,
  ScoreBreakdown,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers to build minimal contexts
// ---------------------------------------------------------------------------
function makeCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  return {
    sha: overrides.sha ?? Math.random().toString(36).slice(2),
    message: overrides.message ?? "feat: update",
    author: overrides.author ?? "dev",
    email: overrides.email ?? "dev@test.com",
    date: overrides.date ?? "2026-02-15T12:00:00Z",
    additions: overrides.additions ?? 10,
    deletions: overrides.deletions ?? 5,
    files: overrides.files ?? ["src/index.ts"],
  };
}

function makeCommits(n: number, overrides: Partial<GitCommit> = {}): GitCommit[] {
  return Array.from({ length: n }, (_, i) =>
    makeCommit({
      sha: `sha-${i}`,
      date: new Date(Date.UTC(2026, 1, 15, 10, i)).toISOString(),
      ...overrides,
    }),
  );
}

function makeGit(overrides: Partial<GitMetrics> = {}): GitMetrics {
  const commits = overrides.commits ?? [];
  return {
    commits,
    totalCommits: overrides.totalCommits ?? commits.length,
    authors: overrides.authors ?? ["dev"],
    additions: overrides.additions ?? 100,
    deletions: overrides.deletions ?? 50,
    filesChanged: overrides.filesChanged ?? ["src/index.ts"],
    commitsByHour: overrides.commitsByHour ?? {},
    firstCommitAt: overrides.firstCommitAt,
    lastCommitAt: overrides.lastCommitAt,
  };
}

function makeCursor(overrides: Partial<CursorStructure> = {}): CursorStructure {
  return {
    rules: overrides.rules ?? [],
    skills: overrides.skills ?? [],
    commands: overrides.commands ?? [],
    hooks: overrides.hooks ?? [],
    rulesCount: overrides.rulesCount ?? 0,
    skillsCount: overrides.skillsCount ?? 0,
    commandsCount: overrides.commandsCount ?? 0,
  };
}

function makeCursorMetrics(overrides: Partial<CursorMetricsData> = {}): CursorMetricsData {
  return {
    totalPrompts: overrides.totalPrompts ?? 0,
    totalToolUses: overrides.totalToolUses ?? 0,
    toolUseBreakdown: overrides.toolUseBreakdown ?? {},
    totalSessions: overrides.totalSessions ?? 1,
    modelsUsed: overrides.modelsUsed ?? ["gpt-4"],
    agentThoughtsCount: overrides.agentThoughtsCount ?? 0,
    fileEditsCount: overrides.fileEditsCount ?? 0,
    shellExecutionsCount: overrides.shellExecutionsCount ?? 0,
    mcpExecutionsCount: overrides.mcpExecutionsCount ?? 0,
    avgResponseTimeMs: overrides.avgResponseTimeMs ?? 200,
    totalEvents: overrides.totalEvents ?? 0,
    firstEventAt: overrides.firstEventAt ?? null,
    lastEventAt: overrides.lastEventAt ?? null,
  };
}

function makeAIReview(overrides: Partial<AIReviewResult> = {}): AIReviewResult {
  return {
    rulesImplemented: overrides.rulesImplemented ?? [],
    codeQualityScore: overrides.codeQualityScore ?? 5,
    bonusFeatures: overrides.bonusFeatures ?? [],
    uxScore: overrides.uxScore ?? 5,
    recommendations: overrides.recommendations ?? [],
  };
}

function makeScore(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    implementation: overrides.implementation ?? { total: 10, rulesComplete: 5, rulesPartial: 3, creative: 2 },
    agentic: overrides.agentic ?? { total: 5, rules: 2, skills: 2, commands: 1 },
    codeQuality: overrides.codeQuality ?? { total: 5, typescript: 2, tests: 2, structure: 1 },
    gitActivity: overrides.gitActivity ?? { total: 5, commits: 2, contributors: 1, regularity: 2 },
    cursorUsage: overrides.cursorUsage ?? { total: 5, prompts: 2, toolDiversity: 1, sessions: 1, models: 1 },
    bonusFeatures: overrides.bonusFeatures,
  };
}

function makeCtx(overrides: Partial<AchievementEvalContext> = {}): AchievementEvalContext {
  return {
    cursor: overrides.cursor ?? makeCursor(),
    cursorMetrics: overrides.cursorMetrics ?? makeCursorMetrics(),
    git: overrides.git ?? makeGit(),
    aiReview: overrides.aiReview ?? makeAIReview(),
    score: overrides.score ?? makeScore(),
    featuresCompliance: overrides.featuresCompliance ?? [],
    previouslyUnlocked: overrides.previouslyUnlocked ?? [],
    allTeamsData: overrides.allTeamsData,
    hackathonStartTime: overrides.hackathonStartTime,
    packageJson: overrides.packageJson,
  };
}

function getIds(result: { id: string }[]): string[] {
  return result.map((r) => r.id).sort();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluateAchievements", () => {
  // -----------------------------------------------------------------------
  // Zero inputs
  // -----------------------------------------------------------------------
  describe("zero / empty inputs", () => {
    it("returns no achievements for empty context", () => {
      const ctx = makeCtx();
      const result = evaluateAchievements(ctx);
      // With zero commits, zero cursor usage, zero rules, nothing should trigger.
      // typescript-purist now requires 5+ commits and 3+ complete rules.
      // clean-history requires 5+ commits.
      const ids = getIds(result);
      expect(ids).toEqual([]);
    });

    it("returns empty array when no commits no rules no cursor", () => {
      const ctx = makeCtx({
        aiReview: makeAIReview(),
      });
      const result = evaluateAchievements(ctx);
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Commit thresholds (multi-level)
  // -----------------------------------------------------------------------
  describe("commit thresholds", () => {
    it("20 commits triggers only 'active'", () => {
      const commits = makeCommits(20);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 20 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).not.toContain("commit-machine");
      expect(ids).not.toContain("git-maniac");
      expect(ids).not.toContain("commit-legend");
    });

    it("60 commits triggers 'active' and 'commit-machine'", () => {
      const commits = makeCommits(60);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 60 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).toContain("commit-machine");
      expect(ids).not.toContain("git-maniac");
    });

    it("120 commits triggers 'active', 'commit-machine', and 'git-maniac'", () => {
      const commits = makeCommits(120);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 120 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).toContain("commit-machine");
      expect(ids).toContain("git-maniac");
      expect(ids).not.toContain("commit-legend");
    });

    it("200 commits triggers all four commit levels", () => {
      const commits = makeCommits(200);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 200 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).toContain("commit-machine");
      expect(ids).toContain("git-maniac");
      expect(ids).toContain("commit-legend");
    });

    it("19 commits does not trigger 'active'", () => {
      const commits = makeCommits(19);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 19 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("active");
    });
  });

  // -----------------------------------------------------------------------
  // Rule multi-level
  // -----------------------------------------------------------------------
  describe("rule multi-level", () => {
    it("3 rules triggers rule-apprentice only", () => {
      const ctx = makeCtx({ cursor: makeCursor({ rulesCount: 3 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("rule-apprentice");
      expect(ids).not.toContain("rule-master");
      expect(ids).not.toContain("rule-overlord");
    });

    it("6 rules triggers rule-apprentice and rule-master", () => {
      const ctx = makeCtx({ cursor: makeCursor({ rulesCount: 6 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("rule-apprentice");
      expect(ids).toContain("rule-master");
      expect(ids).not.toContain("rule-overlord");
    });

    it("10 rules triggers all three rule levels", () => {
      const ctx = makeCtx({ cursor: makeCursor({ rulesCount: 10 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("rule-apprentice");
      expect(ids).toContain("rule-master");
      expect(ids).toContain("rule-overlord");
    });
  });

  // -----------------------------------------------------------------------
  // Skill multi-level
  // -----------------------------------------------------------------------
  describe("skill multi-level", () => {
    it("2 skills triggers skill-novice only", () => {
      const ctx = makeCtx({ cursor: makeCursor({ skillsCount: 2 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("skill-novice");
      expect(ids).not.toContain("skill-master");
    });

    it("5 skills triggers skill-novice and skill-master", () => {
      const ctx = makeCtx({ cursor: makeCursor({ skillsCount: 5 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("skill-novice");
      expect(ids).toContain("skill-master");
      expect(ids).not.toContain("skill-architect");
    });

    it("8 skills triggers all three skill levels", () => {
      const ctx = makeCtx({ cursor: makeCursor({ skillsCount: 8 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("skill-novice");
      expect(ids).toContain("skill-master");
      expect(ids).toContain("skill-architect");
    });
  });

  // -----------------------------------------------------------------------
  // Command multi-level
  // -----------------------------------------------------------------------
  describe("command multi-level", () => {
    it("2 commands triggers commander only", () => {
      const ctx = makeCtx({ cursor: makeCursor({ commandsCount: 2 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("commander");
      expect(ids).not.toContain("command-center");
    });

    it("4 commands triggers commander and command-center", () => {
      const ctx = makeCtx({ cursor: makeCursor({ commandsCount: 4 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("commander");
      expect(ids).toContain("command-center");
      expect(ids).not.toContain("automation-king");
    });

    it("7 commands triggers all three command levels", () => {
      const ctx = makeCtx({ cursor: makeCursor({ commandsCount: 7 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("commander");
      expect(ids).toContain("command-center");
      expect(ids).toContain("automation-king");
    });
  });

  // -----------------------------------------------------------------------
  // Clean history
  // -----------------------------------------------------------------------
  describe("clean-history", () => {
    it("grants clean-history when no dirty commit messages and 5+ commits", () => {
      const commits = [
        makeCommit({ message: "feat: add login page" }),
        makeCommit({ message: "refactor: extract utils" }),
        makeCommit({ message: "feat: add auth flow" }),
        makeCommit({ message: "chore: update dependencies" }),
        makeCommit({ message: "feat: add dashboard" }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 5 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("clean-history");
    });

    it("does not grant clean-history with fewer than 5 commits even if clean", () => {
      const commits = [
        makeCommit({ message: "feat: add login page" }),
        makeCommit({ message: "refactor: extract utils" }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 2 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("clean-history");
    });

    it("does not grant clean-history when there are WIP commits", () => {
      const commits = [
        makeCommit({ message: "feat: add login page" }),
        makeCommit({ message: "wip save progress" }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 2 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("clean-history");
    });

    it("does not grant clean-history when there are fix typo commits", () => {
      const commits = [
        makeCommit({ message: "feat: add login page" }),
        makeCommit({ message: "fix typo in header" }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 2 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("clean-history");
    });

    it("does not grant clean-history for empty commits array", () => {
      const ctx = makeCtx({
        git: makeGit({ commits: [], totalCommits: 0 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("clean-history");
    });
  });

  // -----------------------------------------------------------------------
  // Poet (at least 10 commits contain emoji)
  // -----------------------------------------------------------------------
  describe("poet", () => {
    it("grants poet when at least 10 commits contain an emoji", () => {
      const commits = makeCommits(12, { message: "feat: something" }).map((c, i) => ({
        ...c,
        message: i < 10 ? `feat: thing :rocket:` : "chore: no emoji",
      }));
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 12 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("poet");
    });

    it("does not grant poet when fewer than 10 commits have emoji", () => {
      const commits = makeCommits(15, { message: "feat: x" }).map((c, i) => ({
        ...c,
        message: i < 9 ? "feat: x :fire:" : "feat: x",
      }));
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 15 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("poet");
    });

    it("grants poet when exactly 10 commits have emoji", () => {
      const commits = makeCommits(10, { message: "fix: stuff :tada:" });
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 10 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("poet");
    });
  });

  // -----------------------------------------------------------------------
  // Full squad
  // -----------------------------------------------------------------------
  describe("full-squad", () => {
    it("grants full-squad when 4+ authors each have 3+ commits", () => {
      const commits = [
        ...makeCommits(3, { author: "alice" }),
        ...makeCommits(3, { author: "bob" }),
        ...makeCommits(3, { author: "charlie" }),
        ...makeCommits(3, { author: "diana" }),
      ];
      const ctx = makeCtx({
        git: makeGit({
          commits,
          totalCommits: 12,
          authors: ["alice", "bob", "charlie", "diana"],
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("full-squad");
    });

    it("does not grant full-squad when only 3 authors have 3+ commits", () => {
      const commits = [
        ...makeCommits(3, { author: "alice" }),
        ...makeCommits(3, { author: "bob" }),
        ...makeCommits(3, { author: "charlie" }),
        ...makeCommits(2, { author: "diana" }),
      ];
      const ctx = makeCtx({
        git: makeGit({
          commits,
          totalCommits: 11,
          authors: ["alice", "bob", "charlie", "diana"],
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("full-squad");
    });

    it("does not grant full-squad with many commits from a single author", () => {
      const commits = makeCommits(20, { author: "solo-dev" });
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 20, authors: ["solo-dev"] }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("full-squad");
    });

    it("grants full-squad with 5 active authors", () => {
      const commits = [
        ...makeCommits(5, { author: "a" }),
        ...makeCommits(4, { author: "b" }),
        ...makeCommits(3, { author: "c" }),
        ...makeCommits(3, { author: "d" }),
        ...makeCommits(3, { author: "e" }),
      ];
      const ctx = makeCtx({
        git: makeGit({
          commits,
          totalCommits: 18,
          authors: ["a", "b", "c", "d", "e"],
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("full-squad");
    });
  });

  // -----------------------------------------------------------------------
  // Previously unlocked filtering
  // -----------------------------------------------------------------------
  describe("previously unlocked filtering", () => {
    it("filters out already-unlocked achievements", () => {
      const commits = makeCommits(60);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 60 }),
        previouslyUnlocked: ["active", "commit-machine"],
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("active");
      expect(ids).not.toContain("commit-machine");
    });

    it("returns remaining achievements after filtering", () => {
      const commits = makeCommits(60);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 60 }),
        previouslyUnlocked: ["active"],
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("active");
      expect(ids).toContain("commit-machine");
    });

    it("returns empty when everything is already unlocked", () => {
      const commits = makeCommits(25);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 25 }),
        previouslyUnlocked: ["active", "clean-history", "typescript-purist"],
      });
      const result = evaluateAchievements(ctx);
      // All that could be earned are already unlocked
      const ids = getIds(result);
      expect(ids).not.toContain("active");
      expect(ids).not.toContain("clean-history");
      expect(ids).not.toContain("typescript-purist");
    });
  });

  // -----------------------------------------------------------------------
  // Night owl
  // -----------------------------------------------------------------------
  describe("night-owl", () => {
    it("grants night-owl with 3+ commits between 22-5 UTC", () => {
      const commits = [
        makeCommit({ date: "2026-02-15T23:00:00Z" }),
        makeCommit({ date: "2026-02-15T02:00:00Z" }),
        makeCommit({ date: "2026-02-15T04:30:00Z" }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 3 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("night-owl");
    });

    it("does not grant night-owl with only 2 night commits", () => {
      const commits = [
        makeCommit({ date: "2026-02-15T23:00:00Z" }),
        makeCommit({ date: "2026-02-15T02:00:00Z" }),
        makeCommit({ date: "2026-02-15T12:00:00Z" }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 3 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("night-owl");
    });
  });

  // -----------------------------------------------------------------------
  // Big bang
  // -----------------------------------------------------------------------
  describe("big-bang", () => {
    it("grants big-bang when a commit has >1000 lines changed and 3+ commits", () => {
      const commits = [
        makeCommit({ additions: 800, deletions: 300 }),
        makeCommit({ additions: 10, deletions: 5 }),
        makeCommit({ additions: 10, deletions: 5 }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 3 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("big-bang");
    });

    it("does not grant big-bang with fewer than 3 commits", () => {
      const commits = [makeCommit({ additions: 800, deletions: 300 })];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 1 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("big-bang");
    });
  });

  // -----------------------------------------------------------------------
  // First blood / game-on / full-house
  // -----------------------------------------------------------------------
  describe("implementation achievements", () => {
    it("grants first-blood when at least 1 rule is complete", () => {
      const ctx = makeCtx({
        aiReview: makeAIReview({
          rulesImplemented: [
            { rule: "lobby", status: "complete", confidence: 0.9 },
          ],
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("first-blood");
    });

    it("grants game-on when lobby, role-assignment, and discussion-vote are complete", () => {
      const ctx = makeCtx({
        aiReview: makeAIReview({
          rulesImplemented: [
            { rule: "lobby", status: "complete", confidence: 0.9 },
            { rule: "role-assignment", status: "complete", confidence: 0.9 },
            { rule: "discussion-vote", status: "complete", confidence: 0.9 },
          ],
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("game-on");
      expect(ids).toContain("first-blood");
    });
  });

  // -----------------------------------------------------------------------
  // Package.json based
  // -----------------------------------------------------------------------
  describe("package.json based", () => {
    it("grants overkill with 30+ dependencies", () => {
      const deps: Record<string, string> = {};
      for (let i = 0; i < 25; i++) deps[`dep-${i}`] = "1.0.0";
      const devDeps: Record<string, string> = {};
      for (let i = 0; i < 6; i++) devDeps[`dev-dep-${i}`] = "1.0.0";

      const ctx = makeCtx({
        packageJson: { dependencies: deps, devDependencies: devDeps },
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("overkill");
    });

    it("grants minimalist with <= 5 dependencies and 3+ commits", () => {
      const commits = makeCommits(3);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 3 }),
        packageJson: {
          dependencies: { react: "18.0.0", next: "14.0.0" },
          devDependencies: { typescript: "5.0.0" },
        },
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("minimalist");
    });

    it("does not grant minimalist with fewer than 3 commits", () => {
      const ctx = makeCtx({
        packageJson: {
          dependencies: { react: "18.0.0", next: "14.0.0" },
          devDependencies: { typescript: "5.0.0" },
        },
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("minimalist");
    });
  });

  // -----------------------------------------------------------------------
  // Multi-model
  // -----------------------------------------------------------------------
  describe("multi-model", () => {
    it("grants multi-model with 2+ models", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({
          modelsUsed: ["gpt-4", "claude-3"],
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("multi-model");
    });
  });

  // -----------------------------------------------------------------------
  // Cursor event / prompt multi-level
  // -----------------------------------------------------------------------
  describe("cursor event multi-level", () => {
    it("100 events triggers cursor-user", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalEvents: 100 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("cursor-user");
      expect(ids).not.toContain("cursor-enthusiast");
    });

    it("500 events triggers cursor-user and cursor-enthusiast", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalEvents: 500 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("cursor-user");
      expect(ids).toContain("cursor-enthusiast");
      expect(ids).not.toContain("cursor-addict");
    });

    it("1500 events triggers all three cursor event levels", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalEvents: 1500 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("cursor-user");
      expect(ids).toContain("cursor-enthusiast");
      expect(ids).toContain("cursor-addict");
    });
  });

  describe("prompt multi-level", () => {
    it("50 prompts triggers chatterbox", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalPrompts: 50 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("chatterbox");
      expect(ids).not.toContain("prompt-hacker");
    });

    it("150 prompts triggers chatterbox and prompt-hacker", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalPrompts: 150 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("chatterbox");
      expect(ids).toContain("prompt-hacker");
      expect(ids).not.toContain("ai-whisperer");
    });

    it("300 prompts triggers all three prompt levels", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalPrompts: 300 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("chatterbox");
      expect(ids).toContain("prompt-hacker");
      expect(ids).toContain("ai-whisperer");
    });
  });

  // -----------------------------------------------------------------------
  // Shakespeare
  // -----------------------------------------------------------------------
  describe("shakespeare", () => {
    it("grants shakespeare when a commit message is >200 chars", () => {
      const longMsg = "a".repeat(201);
      const commits = [makeCommit({ message: longMsg })];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 1 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("shakespeare");
    });

    it("does not grant shakespeare when all messages are <=200 chars", () => {
      const commits = [makeCommit({ message: "a".repeat(200) })];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 1 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("shakespeare");
    });
  });

  // -----------------------------------------------------------------------
  // Marathon runner
  // -----------------------------------------------------------------------
  describe("marathon-runner", () => {
    it("grants marathon-runner with 4+ consecutive hours of commits", () => {
      const commits = [
        makeCommit({ date: "2026-02-15T10:00:00Z" }),
        makeCommit({ date: "2026-02-15T11:30:00Z" }),
        makeCommit({ date: "2026-02-15T12:15:00Z" }),
        makeCommit({ date: "2026-02-15T13:45:00Z" }),
      ];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 4 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("marathon-runner");
    });
  });

  // -----------------------------------------------------------------------
  // Prompt architect (combo)
  // -----------------------------------------------------------------------
  describe("prompt-architect", () => {
    it("grants prompt-architect when rules >= 10, skills >= 8, commands >= 7", () => {
      const ctx = makeCtx({
        cursor: makeCursor({ rulesCount: 10, skillsCount: 8, commandsCount: 7 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("prompt-architect");
    });

    it("does not grant prompt-architect when any threshold is not met", () => {
      const ctx = makeCtx({
        cursor: makeCursor({ rulesCount: 10, skillsCount: 7, commandsCount: 7 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("prompt-architect");
    });
  });

  // -----------------------------------------------------------------------
  // Quick start
  // -----------------------------------------------------------------------
  describe("quick-start", () => {
    it("grants quick-start when first commit is within 15 min of hackathon start", () => {
      const ctx = makeCtx({
        hackathonStartTime: "2026-02-15T09:00:00Z",
        git: makeGit({
          commits: [makeCommit({ date: "2026-02-15T09:10:00Z" })],
          totalCommits: 1,
          firstCommitAt: "2026-02-15T09:10:00Z",
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("quick-start");
    });

    it("does not grant quick-start when first commit is after 15 min", () => {
      const ctx = makeCtx({
        hackathonStartTime: "2026-02-15T09:00:00Z",
        git: makeGit({
          commits: [makeCommit({ date: "2026-02-15T09:20:00Z" })],
          totalCommits: 1,
          firstCommitAt: "2026-02-15T09:20:00Z",
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("quick-start");
    });
  });
});
