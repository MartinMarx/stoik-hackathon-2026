import { describe, it, expect, vi } from "vitest";
import {
  calculateScore,
  getTotalScore,
  getMaxPossibleScore,
} from "@/lib/scoring/engine";
import type {
  CursorStructure,
  CursorMetricsData,
  GitMetrics,
  GitCommit,
  AIReviewResult,
  FeatureComplianceResult,
  HackathonFeature,
} from "@/types";

// Mock getCommitRegularity so we control its return value without needing real commit data
vi.mock("@/lib/analyzers/git", () => ({
  getCommitRegularity: vi.fn(() => 0.5),
}));

// ---------------------------------------------------------------------------
// Factories for default / minimal input objects
// ---------------------------------------------------------------------------

function makeCursor(overrides: Partial<CursorStructure> = {}): CursorStructure {
  return {
    rules: [],
    skills: [],
    commands: [],
    hooks: [],
    rulesCount: 0,
    skillsCount: 0,
    commandsCount: 0,
    ...overrides,
  };
}

function makeCursorMetrics(
  overrides: Partial<CursorMetricsData> = {},
): CursorMetricsData {
  return {
    totalPrompts: 0,
    totalToolUses: 0,
    toolUseBreakdown: {},
    totalSessions: 0,
    modelsUsed: [],
    agentThoughtsCount: 0,
    fileEditsCount: 0,
    shellExecutionsCount: 0,
    mcpExecutionsCount: 0,
    mcpServersCount: 0,
    avgResponseTimeMs: 0,
    totalEvents: 0,
    firstEventAt: null,
    lastEventAt: null,
    ...overrides,
  };
}

function makeGit(overrides: Partial<GitMetrics> = {}): GitMetrics {
  const base = {
    commits: [] as GitMetrics["commits"],
    totalCommits: 0,
    authors: [],
    additions: 0,
    deletions: 0,
    filesChanged: [],
    commitsByHour: {},
    ...overrides,
  };
  if (base.totalCommits > 0 && base.commits.length === 0) {
    base.commits = Array.from(
      { length: base.totalCommits },
      (_, i): GitCommit => ({
        sha: `sha${i}`,
        message: "Meaningful commit message that is long enough",
        author: "dev",
        email: "d@e.v",
        date: new Date().toISOString(),
        additions: 0,
        deletions: 0,
        files: [],
      }),
    );
  }
  return base;
}

function makeAIReview(overrides: Partial<AIReviewResult> = {}): AIReviewResult {
  return {
    rulesImplemented: [],
    codeQualityScore: 0,
    bonusFeatures: [],
    uxScore: 0,
    recommendations: [],
    ...overrides,
  };
}

function makeFeature(
  overrides: Partial<HackathonFeature> = {},
): HackathonFeature {
  return {
    id: "f1",
    title: "Feature 1",
    description: "desc",
    criteria: [],
    points: 5,
    difficulty: "easy",
    status: "announced",
    createdAt: "2026-01-01",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Scoring Engine", () => {
  // -----------------------------------------------------------------------
  // Implementation scoring
  // -----------------------------------------------------------------------
  describe("Implementation scoring (max 40)", () => {
    it("returns 0 for implementation when no rules and no bonus", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.implementation.total).toBe(0);
      expect(breakdown.implementation.rulesComplete).toBe(0);
      expect(breakdown.implementation.rulesPartial).toBe(0);
      expect(breakdown.implementation.creative).toBe(0);
    });

    it("scores complete rules correctly", () => {
      const aiReview = makeAIReview({
        rulesImplemented: [
          { rule: "r1", status: "complete", confidence: 1 },
          { rule: "r2", status: "complete", confidence: 1 },
          { rule: "r3", status: "missing", confidence: 0 },
          { rule: "r4", status: "missing", confidence: 0 },
          { rule: "r5", status: "missing", confidence: 0 },
        ],
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      // 2 complete rules out of 5 => 2 * (30/5) = 12
      expect(breakdown.implementation.rulesComplete).toBe(12);
    });

    it("scores partial rules at half value", () => {
      const aiReview = makeAIReview({
        rulesImplemented: [
          { rule: "r1", status: "partial", confidence: 0.5 },
          { rule: "r2", status: "partial", confidence: 0.5 },
          { rule: "r3", status: "missing", confidence: 0 },
          { rule: "r4", status: "missing", confidence: 0 },
          { rule: "r5", status: "missing", confidence: 0 },
        ],
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      // 2 partial out of 5 => 2 * (30/5) * 0.5 = 6
      expect(breakdown.implementation.rulesPartial).toBe(6);
    });

    it("scores creative points from bonus features and ux score when 5+ rules complete", () => {
      const aiReview = makeAIReview({
        rulesImplemented: Array.from({ length: 6 }, (_, i) => ({
          rule: `r${i}`,
          status: "complete" as const,
          confidence: 1,
        })),
        bonusFeatures: ["dark mode", "animations"],
        uxScore: 3,
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      // 2 * 2 + 3 = 7 (gated by 5+ complete rules)
      expect(breakdown.implementation.creative).toBe(7);
    });

    it("gates creative at 0 when fewer than 5 rules complete", () => {
      const aiReview = makeAIReview({
        rulesImplemented: [
          { rule: "r1", status: "complete", confidence: 1 },
          { rule: "r2", status: "complete", confidence: 1 },
        ],
        bonusFeatures: ["dark mode", "animations"],
        uxScore: 5,
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      expect(breakdown.implementation.creative).toBe(0);
    });

    it("caps creative at 10", () => {
      const aiReview = makeAIReview({
        rulesImplemented: Array.from({ length: 6 }, (_, i) => ({
          rule: `r${i}`,
          status: "complete" as const,
          confidence: 1,
        })),
        bonusFeatures: ["a", "b", "c", "d"],
        uxScore: 8,
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      // 4*2 + 8 = 16, capped at 10
      expect(breakdown.implementation.creative).toBe(10);
    });

    it("caps implementation total at 40", () => {
      const aiReview = makeAIReview({
        rulesImplemented: [
          { rule: "r1", status: "complete", confidence: 1 },
          { rule: "r2", status: "complete", confidence: 1 },
        ],
        bonusFeatures: ["a", "b", "c", "d", "e"],
        uxScore: 10,
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      expect(breakdown.implementation.total).toBeLessThanOrEqual(40);
    });
  });

  describe("Cursor activity scoring (max 30) – structure", () => {
    it("returns 0 with empty cursor and empty metrics", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.total).toBe(0);
      expect(breakdown.cursorActivity.rules).toBe(0);
      expect(breakdown.cursorActivity.skills).toBe(0);
      expect(breakdown.cursorActivity.commands).toBe(0);
    });

    it("scores rules with log scaling, capped at 8", () => {
      const cursor = makeCursor({ rulesCount: 3 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.rules).toBeLessThanOrEqual(8);
      expect(breakdown.cursorActivity.rules).toBe(
        Math.round(Math.min(8, Math.log2(4) * 4)),
      );
    });

    it("caps rules at 8", () => {
      const cursor = makeCursor({ rulesCount: 10 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.rules).toBe(8);
    });

    it("scores skills with log scaling, capped at 10", () => {
      const cursor = makeCursor({
        skillsCount: 2,
        skills: [
          { name: "s1", description: "d", contentLength: 600 },
          { name: "s2", description: "d", contentLength: 100 },
        ],
      });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.skills).toBeLessThanOrEqual(10);
    });

    it("caps skills at 10", () => {
      const cursor = makeCursor({
        skillsCount: 10,
        skills: [{ name: "s1", description: "d", contentLength: 600 }],
      });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.skills).toBe(10);
    });

    it("scores commands with log scaling, capped at 5", () => {
      const cursor = makeCursor({ commandsCount: 2 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.commands).toBeLessThanOrEqual(5);
    });

    it("caps commands at 5", () => {
      const cursor = makeCursor({ commandsCount: 10 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.commands).toBe(5);
    });

    it("caps cursor activity total at 30", () => {
      const cursor = makeCursor({
        rulesCount: 10,
        skillsCount: 10,
        commandsCount: 10,
        skills: [{ name: "s1", description: "d", contentLength: 600 }],
      });
      const metrics = makeCursorMetrics({
        totalPrompts: 999,
        toolUseBreakdown: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1 },
        totalSessions: 10,
        modelsUsed: ["a", "b", "c"],
        mcpExecutionsCount: 10,
      });
      const breakdown = calculateScore(
        cursor,
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.total).toBeLessThanOrEqual(30);
    });
  });

  // -----------------------------------------------------------------------
  // Code Quality scoring
  // -----------------------------------------------------------------------
  describe("Code Quality scoring (max 20)", () => {
    it("returns 0 when codeQualityScore is 0", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.codeQuality.total).toBe(0);
      expect(breakdown.codeQuality.typescript).toBe(0);
      expect(breakdown.codeQuality.tests).toBe(0);
      expect(breakdown.codeQuality.structure).toBe(0);
    });

    it("scales from raw 0-15 to max 20 and splits into 40/30/30", () => {
      const aiReview = makeAIReview({ codeQualityScore: 10 });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      expect(breakdown.codeQuality.total).toBeGreaterThan(0);
      expect(breakdown.codeQuality.typescript).toBeGreaterThan(0);
      expect(breakdown.codeQuality.total).toBeLessThanOrEqual(20);
    });

    it("caps total at 20", () => {
      const aiReview = makeAIReview({ codeQualityScore: 20 });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      expect(breakdown.codeQuality.total).toBe(20);
    });
  });

  // -----------------------------------------------------------------------
  // Git Activity scoring
  // -----------------------------------------------------------------------
  describe("Git Activity scoring (max 10)", () => {
    it("returns regularity-only score with empty git (mock returns 0.5)", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      // Mock getCommitRegularity always returns 0.5, so regularity = round(0.5 * 3) = 2
      expect(breakdown.gitActivity.total).toBe(2);
      expect(breakdown.gitActivity.commits).toBe(0);
      expect(breakdown.gitActivity.contributors).toBe(0);
      expect(breakdown.gitActivity.regularity).toBe(2);
    });

    it("scores commits as floor(meaningfulCommits / 40), capped at 4", () => {
      const git = makeGit({ totalCommits: 120 });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        git,
        makeAIReview(),
      );
      expect(breakdown.gitActivity.commits).toBe(3);
    });

    it("caps commits at 4", () => {
      const git = makeGit({ totalCommits: 200 });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        git,
        makeAIReview(),
      );
      expect(breakdown.gitActivity.commits).toBe(4);
    });

    it("scores contributors directly, capped at 3", () => {
      const git = makeGit({ authors: ["a", "b"] });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        git,
        makeAIReview(),
      );
      expect(breakdown.gitActivity.contributors).toBe(2);
    });

    it("caps contributors at 3", () => {
      const git = makeGit({ authors: ["a", "b", "c", "d", "e"] });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        git,
        makeAIReview(),
      );
      expect(breakdown.gitActivity.contributors).toBe(3);
    });

    it("scores regularity from getCommitRegularity mock (0.5 * 3 = 1.5 rounded to 2)", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      // Mock returns 0.5 => Math.round(0.5 * 3) = Math.round(1.5) = 2
      expect(breakdown.gitActivity.regularity).toBe(2);
    });

    it("caps git total at 10", () => {
      const git = makeGit({
        totalCommits: 200,
        authors: ["a", "b", "c", "d", "e"],
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        git,
        makeAIReview(),
      );
      expect(breakdown.gitActivity.total).toBeLessThanOrEqual(10);
    });
  });

  // -----------------------------------------------------------------------
  // Cursor Usage scoring
  // -----------------------------------------------------------------------
  describe("Cursor activity scoring (max 30) – usage", () => {
    it("returns 0 with empty metrics", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.prompts).toBe(0);
      expect(breakdown.cursorActivity.toolDiversity).toBe(0);
      expect(breakdown.cursorActivity.sessions).toBe(0);
      expect(breakdown.cursorActivity.models).toBe(0);
    });

    it("scores prompts with log scale, capped at 4", () => {
      const metrics = makeCursorMetrics({ totalPrompts: 120 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.prompts).toBeGreaterThanOrEqual(0);
      expect(breakdown.cursorActivity.prompts).toBeLessThanOrEqual(4);
    });

    it("caps prompts at 4", () => {
      const metrics = makeCursorMetrics({ totalPrompts: 999 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.prompts).toBe(4);
    });

    it("scores toolDiversity as floor(toolCount / 2), capped at 3", () => {
      const metrics = makeCursorMetrics({
        toolUseBreakdown: { edit: 10, run: 5, read: 3, write: 2, search: 1 },
      });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.toolDiversity).toBe(2);
    });

    it("caps toolDiversity at 3", () => {
      const metrics = makeCursorMetrics({
        toolUseBreakdown: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1 },
      });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.toolDiversity).toBe(3);
    });

    it("scores sessions directly, capped at 3", () => {
      const metrics = makeCursorMetrics({ totalSessions: 2 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.sessions).toBe(2);
    });

    it("caps sessions at 3", () => {
      const metrics = makeCursorMetrics({ totalSessions: 10 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.sessions).toBe(3);
    });

    it("scores models directly, capped at 2", () => {
      const metrics = makeCursorMetrics({
        modelsUsed: ["gpt-4", "claude-3.5"],
      });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.models).toBe(2);
    });

    it("caps models at 2", () => {
      const metrics = makeCursorMetrics({ modelsUsed: ["a", "b", "c", "d"] });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.models).toBe(2);
    });

    it("adds 3 for MCP bonus when mcpExecutionsCount > 0", () => {
      const metrics = makeCursorMetrics({ mcpExecutionsCount: 5 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.total).toBe(3);
    });

    it("no MCP bonus when mcpExecutionsCount is 0", () => {
      const metrics = makeCursorMetrics({ mcpExecutionsCount: 0 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorActivity.total).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Bonus Features scoring
  // -----------------------------------------------------------------------
  describe("Bonus Features scoring", () => {
    it("does not include bonusFeatures when features not provided", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.bonusFeatures).toBeUndefined();
    });

    it("calculates implemented feature points", () => {
      const features: HackathonFeature[] = [
        makeFeature({ id: "f1", points: 5, status: "announced" }),
        makeFeature({ id: "f2", points: 10, status: "announced" }),
        makeFeature({ id: "f3", points: 3, status: "draft" }),
      ];
      const compliance: FeatureComplianceResult[] = [
        {
          featureId: "f1",
          featureTitle: "F1",
          status: "implemented",
          confidence: 1,
        },
        {
          featureId: "f2",
          featureTitle: "F2",
          status: "missing",
          confidence: 0,
        },
      ];

      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
        compliance,
        features,
      );

      expect(breakdown.bonusFeatures).toBeDefined();
      expect(breakdown.bonusFeatures!.implemented).toBe(5);
      expect(breakdown.bonusFeatures!.total).toBe(5);
      expect(breakdown.bonusFeatures!.announced).toBe(15); // 5 + 10
    });

    it("sums points for multiple implemented features", () => {
      const features: HackathonFeature[] = [
        makeFeature({ id: "f1", points: 5, status: "announced" }),
        makeFeature({ id: "f2", points: 10, status: "announced" }),
      ];
      const compliance: FeatureComplianceResult[] = [
        {
          featureId: "f1",
          featureTitle: "F1",
          status: "implemented",
          confidence: 1,
        },
        {
          featureId: "f2",
          featureTitle: "F2",
          status: "implemented",
          confidence: 1,
        },
      ];

      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
        compliance,
        features,
      );

      expect(breakdown.bonusFeatures!.implemented).toBe(15);
      expect(breakdown.bonusFeatures!.total).toBe(15);
    });

    it("announced counts only announced features", () => {
      const features: HackathonFeature[] = [
        makeFeature({ id: "f1", points: 5, status: "announced" }),
        makeFeature({ id: "f2", points: 10, status: "draft" }),
        makeFeature({ id: "f3", points: 7, status: "archived" }),
      ];
      const compliance: FeatureComplianceResult[] = [];

      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
        compliance,
        features,
      );

      expect(breakdown.bonusFeatures!.announced).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // getTotalScore
  // -----------------------------------------------------------------------
  describe("getTotalScore", () => {
    it("sums all category totals", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      const total = getTotalScore(breakdown);
      expect(total).toBe(
        breakdown.implementation.total +
          breakdown.codeQuality.total +
          breakdown.gitActivity.total +
          breakdown.cursorActivity.total,
      );
    });

    it("includes bonus features in total when present", () => {
      const features: HackathonFeature[] = [
        makeFeature({ id: "f1", points: 5, status: "announced" }),
      ];
      const compliance: FeatureComplianceResult[] = [
        {
          featureId: "f1",
          featureTitle: "F1",
          status: "implemented",
          confidence: 1,
        },
      ];

      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
        compliance,
        features,
      );
      const total = getTotalScore(breakdown);

      const baseTotal =
        breakdown.implementation.total +
        breakdown.codeQuality.total +
        breakdown.gitActivity.total +
        breakdown.cursorActivity.total;

      expect(total).toBe(baseTotal + 5);
    });

    it("returns correct total for a scenario with multiple non-zero scores", () => {
      const cursor = makeCursor({
        rulesCount: 2,
        skillsCount: 1,
        commandsCount: 1,
      });
      const metrics = makeCursorMetrics({
        totalPrompts: 100,
        totalSessions: 2,
        modelsUsed: ["claude"],
        toolUseBreakdown: { edit: 10, run: 5 },
        mcpExecutionsCount: 0,
      });
      const git = makeGit({ totalCommits: 30, authors: ["alice", "bob"] });
      const aiReview = makeAIReview({
        rulesImplemented: [
          { rule: "r1", status: "complete", confidence: 1 },
          { rule: "r2", status: "partial", confidence: 0.5 },
        ],
        codeQualityScore: 12,
        bonusFeatures: ["dark-mode"],
        uxScore: 4,
      });

      const breakdown = calculateScore(cursor, metrics, git, aiReview);
      const total = getTotalScore(breakdown);

      expect(total).toBe(
        breakdown.implementation.total +
          breakdown.codeQuality.total +
          breakdown.gitActivity.total +
          breakdown.cursorActivity.total,
      );
    });
  });

  // -----------------------------------------------------------------------
  // getMaxPossibleScore
  // -----------------------------------------------------------------------
  describe("getMaxPossibleScore", () => {
    it("returns 100 when no features provided", () => {
      expect(getMaxPossibleScore()).toBe(100);
    });

    it("returns 100 when features is undefined", () => {
      expect(getMaxPossibleScore(undefined)).toBe(100);
    });

    it("returns 100 when no announced features", () => {
      const features: HackathonFeature[] = [
        makeFeature({ id: "f1", points: 10, status: "draft" }),
        makeFeature({ id: "f2", points: 5, status: "archived" }),
      ];
      expect(getMaxPossibleScore(features)).toBe(100);
    });

    it("adds announced feature points to base 100", () => {
      const features: HackathonFeature[] = [
        makeFeature({ id: "f1", points: 10, status: "announced" }),
        makeFeature({ id: "f2", points: 5, status: "announced" }),
        makeFeature({ id: "f3", points: 3, status: "draft" }),
      ];
      expect(getMaxPossibleScore(features)).toBe(115);
    });

    it("returns 100 with empty features array", () => {
      expect(getMaxPossibleScore([])).toBe(100);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases: all zeros / empty inputs
  // -----------------------------------------------------------------------
  describe("Edge cases", () => {
    it("handles all empty/zero inputs gracefully", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      const total = getTotalScore(breakdown);

      // Only regularity contributes (mock returns 0.5 => round(1.5) = 2)
      expect(breakdown.gitActivity.regularity).toBe(2);
      expect(total).toBe(2);
    });

    it("no category exceeds its max", () => {
      const cursor = makeCursor({
        rulesCount: 100,
        skillsCount: 100,
        commandsCount: 100,
        skills: [{ name: "s", description: "d", contentLength: 1000 }],
      });
      const metrics = makeCursorMetrics({
        totalPrompts: 9999,
        totalSessions: 999,
        modelsUsed: ["a", "b", "c", "d", "e"],
        toolUseBreakdown: {
          a: 1,
          b: 1,
          c: 1,
          d: 1,
          e: 1,
          f: 1,
          g: 1,
          h: 1,
          i: 1,
          j: 1,
        },
        mcpExecutionsCount: 100,
      });
      const git = makeGit({
        totalCommits: 999,
        authors: ["a", "b", "c", "d", "e"],
      });
      const aiReview = makeAIReview({
        rulesImplemented: [{ rule: "r1", status: "complete", confidence: 1 }],
        codeQualityScore: 99,
        bonusFeatures: ["a", "b", "c", "d", "e", "f"],
        uxScore: 10,
      });

      const breakdown = calculateScore(cursor, metrics, git, aiReview);

      expect(breakdown.implementation.total).toBeLessThanOrEqual(40);
      expect(breakdown.codeQuality.total).toBeLessThanOrEqual(20);
      expect(breakdown.gitActivity.total).toBeLessThanOrEqual(10);
      expect(breakdown.cursorActivity.total).toBeLessThanOrEqual(30);
    });

    it("base total never exceeds 100 (without bonus)", () => {
      const cursor = makeCursor({
        rulesCount: 100,
        skillsCount: 100,
        commandsCount: 100,
        skills: [{ name: "s", description: "d", contentLength: 1000 }],
      });
      const metrics = makeCursorMetrics({
        totalPrompts: 9999,
        totalSessions: 999,
        modelsUsed: ["a", "b", "c", "d", "e"],
        toolUseBreakdown: {
          a: 1,
          b: 1,
          c: 1,
          d: 1,
          e: 1,
          f: 1,
          g: 1,
          h: 1,
          i: 1,
          j: 1,
        },
        mcpExecutionsCount: 100,
      });
      const git = makeGit({
        totalCommits: 999,
        authors: ["a", "b", "c", "d", "e"],
      });
      const aiReview = makeAIReview({
        rulesImplemented: [{ rule: "r1", status: "complete", confidence: 1 }],
        codeQualityScore: 99,
        bonusFeatures: ["a", "b", "c", "d", "e", "f"],
        uxScore: 10,
      });

      const breakdown = calculateScore(cursor, metrics, git, aiReview);
      const total = getTotalScore(breakdown);

      expect(total).toBeLessThanOrEqual(100);
    });
  });
});
