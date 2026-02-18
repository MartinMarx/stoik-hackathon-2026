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
    avgResponseTimeMs: 0,
    totalEvents: 0,
    firstEventAt: null,
    lastEventAt: null,
    ...overrides,
  };
}

function makeGit(overrides: Partial<GitMetrics> = {}): GitMetrics {
  return {
    commits: [],
    totalCommits: 0,
    authors: [],
    additions: 0,
    deletions: 0,
    filesChanged: [],
    commitsByHour: {},
    ...overrides,
  };
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
  describe("Implementation scoring (max 35)", () => {
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
      // 2 complete rules out of 5 => 2 * (25/5) = 10
      expect(breakdown.implementation.rulesComplete).toBe(10);
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
      // 2 partial out of 5 => 2 * (25/5) * 0.5 = 5
      expect(breakdown.implementation.rulesPartial).toBe(5);
    });

    it("scores creative points from bonus features and ux score", () => {
      const aiReview = makeAIReview({
        bonusFeatures: ["dark mode", "animations"],
        uxScore: 3,
      });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      // 2 * 2 + 3 = 7
      expect(breakdown.implementation.creative).toBe(7);
    });

    it("caps creative at 10", () => {
      const aiReview = makeAIReview({
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

    it("caps implementation total at 35", () => {
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
      expect(breakdown.implementation.total).toBeLessThanOrEqual(35);
    });
  });

  // -----------------------------------------------------------------------
  // Agentic scoring
  // -----------------------------------------------------------------------
  describe("Agentic scoring (max 25)", () => {
    it("returns 0 with empty cursor", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.agentic.total).toBe(0);
      expect(breakdown.agentic.rules).toBe(0);
      expect(breakdown.agentic.skills).toBe(0);
      expect(breakdown.agentic.commands).toBe(0);
    });

    it("scores rules at 2.5 each, capped at 10 (rounded)", () => {
      const cursor = makeCursor({ rulesCount: 3 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.agentic.rules).toBe(8);
    });

    it("caps rules at 10", () => {
      const cursor = makeCursor({ rulesCount: 10 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.agentic.rules).toBe(10);
    });

    it("adds skills bonus for contentLength > 500", () => {
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
      // 2 * 2.5 + 2 (bonus) = 7
      expect(breakdown.agentic.skills).toBe(7);
    });

    it("no skills bonus when all contentLength <= 500", () => {
      const cursor = makeCursor({
        skillsCount: 2,
        skills: [
          { name: "s1", description: "d", contentLength: 100 },
          { name: "s2", description: "d", contentLength: 500 },
        ],
      });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      // 2 * 2.5 = 5
      expect(breakdown.agentic.skills).toBe(5);
    });

    it("caps skills at 10", () => {
      const cursor = makeCursor({
        skillsCount: 5,
        skills: [{ name: "s1", description: "d", contentLength: 600 }],
      });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      // 5 * 2.5 + 2 = 14.5, capped at 10
      expect(breakdown.agentic.skills).toBe(10);
    });

    it("scores commands at 2 each, capped at 5", () => {
      const cursor = makeCursor({ commandsCount: 2 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.agentic.commands).toBe(4);
    });

    it("caps commands at 5", () => {
      const cursor = makeCursor({ commandsCount: 10 });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.agentic.commands).toBe(5);
    });

    it("caps agentic total at 25", () => {
      const cursor = makeCursor({
        rulesCount: 10,
        skillsCount: 10,
        commandsCount: 10,
        skills: [{ name: "s1", description: "d", contentLength: 600 }],
      });
      const breakdown = calculateScore(
        cursor,
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.agentic.total).toBeLessThanOrEqual(25);
      expect(breakdown.agentic.total).toBe(25);
    });
  });

  // -----------------------------------------------------------------------
  // Code Quality scoring
  // -----------------------------------------------------------------------
  describe("Code Quality scoring (max 15)", () => {
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

    it("splits score into 40/30/30", () => {
      const aiReview = makeAIReview({ codeQualityScore: 10 });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      expect(breakdown.codeQuality.typescript).toBe(4);
      expect(breakdown.codeQuality.tests).toBe(3);
      expect(breakdown.codeQuality.structure).toBe(3);
      expect(breakdown.codeQuality.total).toBe(10);
    });

    it("caps total at 15", () => {
      const aiReview = makeAIReview({ codeQualityScore: 20 });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        aiReview,
      );
      expect(breakdown.codeQuality.total).toBe(15);
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

    it("scores commits as floor(totalCommits / 15), capped at 4", () => {
      const git = makeGit({ totalCommits: 45 });
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        git,
        makeAIReview(),
      );
      // floor(45 / 15) = 3
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
  describe("Cursor Usage scoring (max 15)", () => {
    it("returns 0 with empty metrics", () => {
      const breakdown = calculateScore(
        makeCursor(),
        makeCursorMetrics(),
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorUsage.total).toBe(0);
      expect(breakdown.cursorUsage.prompts).toBe(0);
      expect(breakdown.cursorUsage.toolDiversity).toBe(0);
      expect(breakdown.cursorUsage.sessions).toBe(0);
      expect(breakdown.cursorUsage.models).toBe(0);
    });

    it("scores prompts as floor(totalPrompts / 50), capped at 4", () => {
      const metrics = makeCursorMetrics({ totalPrompts: 120 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      // floor(120 / 50) = 2
      expect(breakdown.cursorUsage.prompts).toBe(2);
    });

    it("caps prompts at 4", () => {
      const metrics = makeCursorMetrics({ totalPrompts: 999 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorUsage.prompts).toBe(4);
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
      // floor(5 / 2) = 2
      expect(breakdown.cursorUsage.toolDiversity).toBe(2);
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
      // floor(8 / 2) = 4, capped at 3
      expect(breakdown.cursorUsage.toolDiversity).toBe(3);
    });

    it("scores sessions directly, capped at 3", () => {
      const metrics = makeCursorMetrics({ totalSessions: 2 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorUsage.sessions).toBe(2);
    });

    it("caps sessions at 3", () => {
      const metrics = makeCursorMetrics({ totalSessions: 10 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorUsage.sessions).toBe(3);
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
      expect(breakdown.cursorUsage.models).toBe(2);
    });

    it("caps models at 2", () => {
      const metrics = makeCursorMetrics({ modelsUsed: ["a", "b", "c", "d"] });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorUsage.models).toBe(2);
    });

    it("adds 3 for MCP bonus when mcpExecutionsCount > 0", () => {
      const metrics = makeCursorMetrics({ mcpExecutionsCount: 5 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      // 0 + 0 + 0 + 0 + 3 = 3
      expect(breakdown.cursorUsage.total).toBe(3);
    });

    it("no MCP bonus when mcpExecutionsCount is 0", () => {
      const metrics = makeCursorMetrics({ mcpExecutionsCount: 0 });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      expect(breakdown.cursorUsage.total).toBe(0);
    });

    it("caps cursor usage total at 15", () => {
      const metrics = makeCursorMetrics({
        totalPrompts: 999,
        toolUseBreakdown: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1 },
        totalSessions: 10,
        modelsUsed: ["a", "b", "c"],
        mcpExecutionsCount: 10,
      });
      const breakdown = calculateScore(
        makeCursor(),
        metrics,
        makeGit(),
        makeAIReview(),
      );
      // 4 + 3 + 3 + 2 + 3 = 15
      expect(breakdown.cursorUsage.total).toBeLessThanOrEqual(15);
      expect(breakdown.cursorUsage.total).toBe(15);
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
          breakdown.agentic.total +
          breakdown.codeQuality.total +
          breakdown.gitActivity.total +
          breakdown.cursorUsage.total,
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
        breakdown.agentic.total +
        breakdown.codeQuality.total +
        breakdown.gitActivity.total +
        breakdown.cursorUsage.total;

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
          breakdown.agentic.total +
          breakdown.codeQuality.total +
          breakdown.gitActivity.total +
          breakdown.cursorUsage.total,
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

      expect(breakdown.implementation.total).toBeLessThanOrEqual(35);
      expect(breakdown.agentic.total).toBeLessThanOrEqual(25);
      expect(breakdown.codeQuality.total).toBeLessThanOrEqual(15);
      expect(breakdown.gitActivity.total).toBeLessThanOrEqual(10);
      expect(breakdown.cursorUsage.total).toBeLessThanOrEqual(15);
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
