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

function makeCommits(
  n: number,
  overrides: Partial<GitCommit> = {},
): GitCommit[] {
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

function makeCursorMetrics(
  overrides: Partial<CursorMetricsData> = {},
): CursorMetricsData {
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
    mcpServersCount: overrides.mcpServersCount ?? 0,
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
    implementation: overrides.implementation ?? {
      total: 10,
      rulesComplete: 5,
      rulesPartial: 3,
      creative: 2,
    },
    codeQuality: overrides.codeQuality ?? {
      total: 5,
      typescript: 2,
      tests: 2,
      structure: 1,
    },
    gitActivity: overrides.gitActivity ?? {
      total: 5,
      commits: 2,
      contributors: 1,
      regularity: 2,
    },
    cursorActivity: overrides.cursorActivity ?? {
      total: 10,
      rules: 2,
      skills: 2,
      commands: 1,
      prompts: 2,
      toolDiversity: 1,
      sessions: 1,
      models: 1,
    },
    bonusFeatures: overrides.bonusFeatures,
  };
}

function makeCtx(
  overrides: Partial<AchievementEvalContext> = {},
): AchievementEvalContext {
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
      // clean-history requires 10+ commits.
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
    it("40 commits triggers only 'active'", () => {
      const commits = makeCommits(40);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 40 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).not.toContain("commit-machine");
      expect(ids).not.toContain("git-maniac");
      expect(ids).not.toContain("commit-legend");
    });

    it("100 commits triggers 'active' and 'commit-machine'", () => {
      const commits = makeCommits(100);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 100 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).toContain("commit-machine");
      expect(ids).not.toContain("git-maniac");
    });

    it("200 commits triggers 'active', 'commit-machine', and 'git-maniac'", () => {
      const commits = makeCommits(200);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 200 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).toContain("commit-machine");
      expect(ids).toContain("git-maniac");
      expect(ids).not.toContain("commit-legend");
    });

    it("350 commits triggers all four commit levels", () => {
      const commits = makeCommits(350);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 350 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("active");
      expect(ids).toContain("commit-machine");
      expect(ids).toContain("git-maniac");
      expect(ids).toContain("commit-legend");
    });

    it("39 commits does not trigger 'active'", () => {
      const commits = makeCommits(39);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 39 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("active");
    });
  });

  // -----------------------------------------------------------------------
  // Rule multi-level
  // -----------------------------------------------------------------------
  describe("rule multi-level", () => {
    it("4 rules triggers rule-apprentice only", () => {
      const ctx = makeCtx({ cursor: makeCursor({ rulesCount: 4 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("rule-apprentice");
      expect(ids).not.toContain("rule-master");
      expect(ids).not.toContain("rule-overlord");
    });

    it("8 rules triggers rule-apprentice and rule-master", () => {
      const ctx = makeCtx({ cursor: makeCursor({ rulesCount: 8 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("rule-apprentice");
      expect(ids).toContain("rule-master");
      expect(ids).not.toContain("rule-overlord");
    });

    it("14 rules triggers all three rule levels", () => {
      const ctx = makeCtx({ cursor: makeCursor({ rulesCount: 14 }) });
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
    it("3 skills triggers skill-novice only", () => {
      const ctx = makeCtx({ cursor: makeCursor({ skillsCount: 3 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("skill-novice");
      expect(ids).not.toContain("skill-master");
    });

    it("6 skills triggers skill-novice and skill-master", () => {
      const ctx = makeCtx({ cursor: makeCursor({ skillsCount: 6 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("skill-novice");
      expect(ids).toContain("skill-master");
      expect(ids).not.toContain("skill-architect");
    });

    it("10 skills triggers all three skill levels", () => {
      const ctx = makeCtx({ cursor: makeCursor({ skillsCount: 10 }) });
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
    it("3 commands triggers commander only", () => {
      const ctx = makeCtx({ cursor: makeCursor({ commandsCount: 3 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("commander");
      expect(ids).not.toContain("command-center");
    });

    it("5 commands triggers commander and command-center", () => {
      const ctx = makeCtx({ cursor: makeCursor({ commandsCount: 5 }) });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("commander");
      expect(ids).toContain("command-center");
      expect(ids).not.toContain("automation-king");
    });

    it("9 commands triggers all three command levels", () => {
      const ctx = makeCtx({ cursor: makeCursor({ commandsCount: 9 }) });
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
    it("grants clean-history when no dirty commit messages and 10+ commits", () => {
      const commits = Array.from({ length: 10 }, (_, i) =>
        makeCommit({ message: `feat: change ${i}` }),
      );
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 10 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("clean-history");
    });

    it("does not grant clean-history with fewer than 10 commits even if clean", () => {
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
      const commits = makeCommits(12, { message: "feat: something" }).map(
        (c, i) => ({
          ...c,
          message: i < 10 ? `feat: thing :rocket:` : "chore: no emoji",
        }),
      );
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
      const commits = makeCommits(100);
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 100 }),
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
    it("grants big-bang when a commit has 3000+ lines changed and 3+ commits", () => {
      const commits = [
        makeCommit({ additions: 2500, deletions: 600 }),
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
      const commits = [makeCommit({ additions: 2500, deletions: 600 })];
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

    it("grants pipeline-builder when CI/DevOps config is in filesChanged", () => {
      const ctx = makeCtx({
        git: makeGit({
          filesChanged: ["src/index.ts", ".github/workflows/ci.yml"],
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("pipeline-builder");
    });

    it("does not grant pipeline-builder without CI config paths", () => {
      const ctx = makeCtx({
        git: makeGit({ filesChanged: ["src/index.ts", "package.json"] }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("pipeline-builder");
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
    it("2000 events triggers cursor-user", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalEvents: 2000 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("cursor-user");
      expect(ids).not.toContain("cursor-enthusiast");
    });

    it("8000 events triggers cursor-user and cursor-enthusiast", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalEvents: 8000 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("cursor-user");
      expect(ids).toContain("cursor-enthusiast");
      expect(ids).not.toContain("cursor-addict");
    });

    it("20000 events triggers all three cursor event levels", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalEvents: 20000 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("cursor-user");
      expect(ids).toContain("cursor-enthusiast");
      expect(ids).toContain("cursor-addict");
    });
  });

  describe("prompt multi-level", () => {
    it("100 prompts triggers chatterbox", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalPrompts: 100 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("chatterbox");
      expect(ids).not.toContain("prompt-hacker");
    });

    it("250 prompts triggers chatterbox and prompt-hacker", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalPrompts: 250 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("chatterbox");
      expect(ids).toContain("prompt-hacker");
      expect(ids).not.toContain("ai-whisperer");
    });

    it("500 prompts triggers all three prompt levels", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ totalPrompts: 500 }),
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
  describe("mcp-explorer", () => {
    it("grants mcp-explorer when 3+ MCP servers used", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ mcpServersCount: 3 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("mcp-explorer");
    });

    it("does not grant mcp-explorer with fewer than 3 MCP servers", () => {
      const ctx = makeCtx({
        cursorMetrics: makeCursorMetrics({ mcpServersCount: 2 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).not.toContain("mcp-explorer");
    });
  });

  describe("shakespeare", () => {
    it("grants shakespeare when a commit message is 500+ chars", () => {
      const longMsg = "a".repeat(500);
      const commits = [makeCommit({ message: longMsg })];
      const ctx = makeCtx({
        git: makeGit({ commits, totalCommits: 1 }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("shakespeare");
    });

    it("does not grant shakespeare when all messages are <500 chars", () => {
      const commits = [makeCommit({ message: "a".repeat(499) })];
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
    it("grants prompt-architect when rules >= 14, skills >= 10, commands >= 9", () => {
      const ctx = makeCtx({
        cursor: makeCursor({
          rulesCount: 14,
          skillsCount: 10,
          commandsCount: 9,
        }),
      });
      const ids = getIds(evaluateAchievements(ctx));
      expect(ids).toContain("prompt-architect");
    });

    it("does not grant prompt-architect when any threshold is not met", () => {
      const ctx = makeCtx({
        cursor: makeCursor({
          rulesCount: 10,
          skillsCount: 7,
          commandsCount: 7,
        }),
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
