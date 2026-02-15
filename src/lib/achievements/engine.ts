import type {
  CursorStructure,
  CursorMetricsData,
  GitMetrics,
  AIReviewResult,
  ScoreBreakdown,
  FeatureComplianceResult,
} from "@/types";
import {
  hasCleanHistory,
  allCommitsHaveEmoji,
  getLongestCommitMessage,
  getMaxConsecutiveHours,
} from "@/lib/analyzers/git";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AchievementEvalContext {
  cursor: CursorStructure;
  cursorMetrics: CursorMetricsData;
  git: GitMetrics;
  aiReview: AIReviewResult;
  score: ScoreBreakdown;
  featuresCompliance: FeatureComplianceResult[];
  previouslyUnlocked: string[];
  allTeamsData?: { teamId: string; featuresImplemented: number; featurePoints: number }[];
  hackathonStartTime?: string;
  packageJson?: { dependencies: Record<string, string>; devDependencies: Record<string, string> } | null;
}

interface EarnedAchievement {
  id: string;
  data?: Record<string, unknown>;
}

type Checker = (ctx: AchievementEvalContext) => EarnedAchievement[];

// ---------------------------------------------------------------------------
// Threshold helpers for multi-level achievements
// ---------------------------------------------------------------------------
function checkMultiLevel(
  value: number,
  levels: { id: string; threshold: number }[],
): EarnedAchievement[] {
  const earned: EarnedAchievement[] = [];
  // Sort by threshold ascending so all lower levels are included
  const sorted = [...levels].sort((a, b) => a.threshold - b.threshold);
  for (const level of sorted) {
    if (value >= level.threshold) {
      earned.push({ id: level.id, data: { value } });
    }
  }
  return earned;
}

// ---------------------------------------------------------------------------
// 1. Threshold-based (multi-level) checkers
// ---------------------------------------------------------------------------
const checkCommitLevels: Checker = (ctx) =>
  checkMultiLevel(ctx.git.totalCommits, [
    { id: "active", threshold: 20 },
    { id: "commit-machine", threshold: 60 },
    { id: "git-maniac", threshold: 120 },
    { id: "commit-legend", threshold: 200 },
  ]);

const checkRuleLevels: Checker = (ctx) =>
  checkMultiLevel(ctx.cursor.rulesCount, [
    { id: "rule-apprentice", threshold: 3 },
    { id: "rule-master", threshold: 6 },
    { id: "rule-overlord", threshold: 10 },
  ]);

const checkSkillLevels: Checker = (ctx) =>
  checkMultiLevel(ctx.cursor.skillsCount, [
    { id: "skill-novice", threshold: 2 },
    { id: "skill-master", threshold: 5 },
    { id: "skill-architect", threshold: 8 },
  ]);

const checkCommandLevels: Checker = (ctx) =>
  checkMultiLevel(ctx.cursor.commandsCount, [
    { id: "commander", threshold: 2 },
    { id: "command-center", threshold: 4 },
    { id: "automation-king", threshold: 7 },
  ]);

const checkCursorEventLevels: Checker = (ctx) =>
  checkMultiLevel(ctx.cursorMetrics.totalEvents, [
    { id: "cursor-user", threshold: 100 },
    { id: "cursor-enthusiast", threshold: 500 },
    { id: "cursor-addict", threshold: 1500 },
  ]);

const checkPromptLevels: Checker = (ctx) =>
  checkMultiLevel(ctx.cursorMetrics.totalPrompts, [
    { id: "chatterbox", threshold: 50 },
    { id: "prompt-hacker", threshold: 150 },
    { id: "ai-whisperer", threshold: 300 },
  ]);

// ---------------------------------------------------------------------------
// 2. Git pattern-based checkers
// ---------------------------------------------------------------------------
const checkNightOwl: Checker = (ctx) => {
  const nightCommits = ctx.git.commits.filter((c) => {
    if (!c.date) return false;
    const hour = new Date(c.date).getUTCHours();
    return hour >= 22 || hour < 5;
  });
  if (nightCommits.length >= 3) {
    return [{ id: "night-owl", data: { nightCommits: nightCommits.length } }];
  }
  return [];
};

const checkCleanHistory: Checker = (ctx) => {
  if (ctx.git.commits.length < 5) return [];
  if (hasCleanHistory(ctx.git.commits)) {
    return [{ id: "clean-history" }];
  }
  return [];
};

const checkRefactorKing: Checker = (ctx) => {
  const found = ctx.git.commits.some((c) => c.deletions > 300);
  return found ? [{ id: "refactor-king" }] : [];
};

const checkAtomicHabits: Checker = (ctx) => {
  const atomicCount = ctx.git.commits.filter(
    (c) => c.additions + c.deletions < 50,
  ).length;
  if (atomicCount >= 20) {
    return [{ id: "atomic-habits", data: { atomicCommits: atomicCount } }];
  }
  return [];
};

const checkBigBang: Checker = (ctx) => {
  if (ctx.git.totalCommits < 3) return [];
  const found = ctx.git.commits.some((c) => c.additions + c.deletions > 1000);
  return found ? [{ id: "big-bang" }] : [];
};

const checkPoet: Checker = (ctx) => {
  if (ctx.git.totalCommits >= 5 && allCommitsHaveEmoji(ctx.git.commits)) {
    return [{ id: "poet" }];
  }
  return [];
};

const checkShakespeare: Checker = (ctx) => {
  const longest = getLongestCommitMessage(ctx.git.commits);
  if (longest && longest.length > 200) {
    return [{ id: "shakespeare", data: { length: longest.length, sha: longest.sha } }];
  }
  return [];
};

const checkMarathonRunner: Checker = (ctx) => {
  const hours = getMaxConsecutiveHours(ctx.git.commits);
  if (hours >= 4) {
    return [{ id: "marathon-runner", data: { consecutiveHours: hours } }];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 3. AI-review based checkers
// ---------------------------------------------------------------------------
const checkFirstBlood: Checker = (ctx) => {
  const completeRules = ctx.aiReview.rulesImplemented.filter(
    (r) => r.status === "complete",
  );
  if (completeRules.length >= 1) {
    return [{ id: "first-blood" }];
  }
  return [];
};

const checkGameOn: Checker = (ctx) => {
  const required = ["lobby", "role-assignment", "discussion-vote"];
  const allComplete = required.every((ruleKey) =>
    ctx.aiReview.rulesImplemented.some(
      (r) => r.rule.toLowerCase().includes(ruleKey) && r.status === "complete",
    ),
  );
  if (allComplete) {
    return [{ id: "game-on" }];
  }
  return [];
};

const checkFullHouse: Checker = (ctx) => {
  const completeCount = ctx.aiReview.rulesImplemented.filter(
    (r) => r.status === "complete",
  ).length;
  if (completeCount >= 15) {
    return [{ id: "full-house" }];
  }
  return [];
};

const checkBeyondRules: Checker = (ctx) => {
  if (ctx.aiReview.bonusFeatures.length >= 3) {
    return [{ id: "beyond-rules", data: { bonusCount: ctx.aiReview.bonusFeatures.length } }];
  }
  return [];
};

const checkMasterpiece: Checker = (ctx) => {
  if (ctx.score.implementation.total > 30) {
    return [{ id: "masterpiece", data: { score: ctx.score.implementation.total } }];
  }
  return [];
};

const checkZeroBug: Checker = (ctx) => {
  // Need real implementation to judge "zero bugs"
  const completeRules = ctx.aiReview.rulesImplemented.filter(r => r.status === "complete").length;
  if (completeRules < 3) return [];
  if (ctx.aiReview.bugs.length === 0) {
    return [{ id: "zero-bug" }];
  }
  return [];
};

const checkEyeCandy: Checker = (ctx) => {
  // Need real implementation before awarding UX achievement
  const completeRules = ctx.aiReview.rulesImplemented.filter(r => r.status === "complete").length;
  if (completeRules < 3) return [];
  if (ctx.aiReview.uxScore >= 8) {
    return [{ id: "eye-candy", data: { uxScore: ctx.aiReview.uxScore } }];
  }
  return [];
};

const checkTypescriptPurist: Checker = (ctx) => {
  // Need meaningful codebase and commit history, not just template
  if (ctx.git.totalCommits < 5) return [];
  if (ctx.aiReview.rulesImplemented.filter(r => r.status === "complete").length < 3) return [];
  const hasAnyBug = ctx.aiReview.bugs.some((b) =>
    b.description.toLowerCase().includes("any"),
  );
  if (!hasAnyBug) {
    return [{ id: "typescript-purist" }];
  }
  return [];
};

const checkTestArchitect: Checker = (ctx) => {
  const hasTests =
    ctx.aiReview.bonusFeatures.some((f) => f.toLowerCase().includes("test")) ||
    ctx.aiReview.recommendations.some((r) => r.toLowerCase().includes("test"));
  // Also check if test files exist in git
  const testFiles = ctx.git.filesChanged.filter(
    (f) => f.includes(".test.") || f.includes(".spec.") || f.includes("__tests__"),
  );
  if (hasTests || testFiles.length >= 10) {
    return [{ id: "test-architect", data: { testFiles: testFiles.length } }];
  }
  return [];
};

const checkDocWriter: Checker = (ctx) => {
  if (ctx.git.totalCommits < 5) return [];
  const hasDocs =
    ctx.aiReview.bonusFeatures.some((f) => f.toLowerCase().includes("doc")) ||
    ctx.aiReview.recommendations.some((r) => r.toLowerCase().includes("jsdoc")) ||
    ctx.git.filesChanged.some(
      (f) => f.endsWith(".md") && !f.toLowerCase().includes("readme"),
    );
  if (hasDocs) {
    return [{ id: "doc-writer" }];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 4. Package.json based checkers
// ---------------------------------------------------------------------------
const checkOverkill: Checker = (ctx) => {
  if (!ctx.packageJson) return [];
  const deps = Object.keys(ctx.packageJson.dependencies ?? {}).length;
  const devDeps = Object.keys(ctx.packageJson.devDependencies ?? {}).length;
  if (deps + devDeps >= 30) {
    return [{ id: "overkill", data: { totalDeps: deps + devDeps } }];
  }
  return [];
};

const checkMinimalist: Checker = (ctx) => {
  if (ctx.git.totalCommits < 3) return [];
  if (!ctx.packageJson) return [];
  const deps = Object.keys(ctx.packageJson.dependencies ?? {}).length;
  const devDeps = Object.keys(ctx.packageJson.devDependencies ?? {}).length;
  if (deps + devDeps <= 5) {
    return [{ id: "minimalist", data: { totalDeps: deps + devDeps } }];
  }
  return [];
};

const checkPixelPerfect: Checker = (ctx) => {
  if (!ctx.packageJson) return [];
  const allDeps = {
    ...ctx.packageJson.dependencies,
    ...ctx.packageJson.devDependencies,
  };
  const animationLibs = ["framer-motion", "gsap", "animejs", "anime.js", "motion", "lottie-web", "react-spring"];
  const hasAnimation = animationLibs.some((lib) => lib in allDeps);
  if (hasAnimation) {
    return [{ id: "pixel-perfect" }];
  }
  return [];
};

const checkDarkSide: Checker = (ctx) => {
  if (!ctx.packageJson) return [];
  const allDeps = {
    ...ctx.packageJson.dependencies,
    ...ctx.packageJson.devDependencies,
  };
  if ("next-themes" in allDeps) {
    return [{ id: "dark-side" }];
  }
  return [];
};

const checkResponsiveHero: Checker = (ctx) => {
  // Detected primarily through AI review
  const detected =
    ctx.aiReview.bonusFeatures.some((f) => f.toLowerCase().includes("responsive")) ||
    ctx.aiReview.recommendations.some((r) => r.toLowerCase().includes("responsive"));
  if (detected) {
    return [{ id: "responsive-hero" }];
  }
  return [];
};

const checkAccessible: Checker = (ctx) => {
  const detected =
    ctx.aiReview.bonusFeatures.some(
      (f) => f.toLowerCase().includes("a11y") || f.toLowerCase().includes("accessible") || f.toLowerCase().includes("aria"),
    ) ||
    ctx.aiReview.recommendations.some(
      (r) => r.toLowerCase().includes("a11y") || r.toLowerCase().includes("aria"),
    );
  if (detected) {
    return [{ id: "accessible" }];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 5. Cursor-specific checkers
// ---------------------------------------------------------------------------
const checkToolCollector: Checker = (ctx) => {
  const toolCount = Object.keys(ctx.cursorMetrics.toolUseBreakdown).length;
  if (toolCount >= 5) {
    return [{ id: "tool-collector", data: { toolTypes: toolCount } }];
  }
  return [];
};

const checkMcpExplorer: Checker = (ctx) => {
  if (ctx.cursorMetrics.mcpExecutionsCount > 0) {
    return [{ id: "mcp-explorer", data: { mcpCount: ctx.cursorMetrics.mcpExecutionsCount } }];
  }
  return [];
};

const checkSpeedCoder: Checker = (ctx) => {
  // Use git commit timestamps as proxy: 10+ commits within a 5-minute window
  const sorted = [...ctx.git.commits]
    .filter((c) => c.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const fiveMinMs = 5 * 60 * 1000;
  for (let i = 0; i <= sorted.length - 10; i++) {
    const windowStart = new Date(sorted[i].date).getTime();
    const windowEnd = new Date(sorted[i + 9].date).getTime();
    if (windowEnd - windowStart <= fiveMinMs) {
      return [{ id: "speed-coder" }];
    }
  }
  return [];
};

const checkTabMaster: Checker = (ctx) => {
  const breakdown = ctx.cursorMetrics.toolUseBreakdown;
  const hasTab = Object.keys(breakdown).some(
    (key) => key.toLowerCase().includes("tab") || key.toLowerCase().includes("completion"),
  );
  if (hasTab) {
    return [{ id: "tab-master" }];
  }
  return [];
};

const checkMultiModel: Checker = (ctx) => {
  if (ctx.cursorMetrics.modelsUsed.length >= 2) {
    return [{ id: "multi-model", data: { models: ctx.cursorMetrics.modelsUsed } }];
  }
  return [];
};

const checkConferenceCall: Checker = (ctx) => {
  if (ctx.cursorMetrics.totalSessions >= 3) {
    return [{ id: "conference-call", data: { sessions: ctx.cursorMetrics.totalSessions } }];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 6. Agentic combo checkers
// ---------------------------------------------------------------------------
const checkPromptArchitect: Checker = (ctx) => {
  if (
    ctx.cursor.rulesCount >= 10 &&
    ctx.cursor.skillsCount >= 8 &&
    ctx.cursor.commandsCount >= 7
  ) {
    return [{ id: "prompt-architect" }];
  }
  return [];
};

const checkPromptEngineer: Checker = (ctx) => {
  if (ctx.cursor.skills.some((s) => s.contentLength > 500)) {
    return [{ id: "prompt-engineer" }];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 7. Relative checkers (needs allTeamsData)
// ---------------------------------------------------------------------------
const checkFeatureHunter: Checker = (ctx) => {
  if (!ctx.allTeamsData || ctx.allTeamsData.length === 0) return [];

  const maxFeatures = Math.max(...ctx.allTeamsData.map((t) => t.featuresImplemented));
  // Check if current team data matches the max
  const compliance = ctx.featuresCompliance.filter(
    (f) => f.status === "implemented",
  ).length;
  if (compliance >= maxFeatures && maxFeatures > 0) {
    return [{ id: "feature-hunter", data: { features: compliance } }];
  }
  return [];
};

const checkPointMachine: Checker = (ctx) => {
  if (!ctx.allTeamsData || ctx.allTeamsData.length === 0) return [];

  const maxPoints = Math.max(...ctx.allTeamsData.map((t) => t.featurePoints));
  const teamPoints = ctx.score.bonusFeatures?.total ?? 0;
  if (teamPoints >= maxPoints && maxPoints > 0) {
    return [{ id: "point-machine", data: { points: teamPoints } }];
  }
  return [];
};

// ---------------------------------------------------------------------------
// 8. Time-based checkers
// ---------------------------------------------------------------------------
const checkQuickStart: Checker = (ctx) => {
  if (!ctx.hackathonStartTime || !ctx.git.firstCommitAt) return [];

  const start = new Date(ctx.hackathonStartTime).getTime();
  const firstCommit = new Date(ctx.git.firstCommitAt).getTime();
  const diffMinutes = (firstCommit - start) / (1000 * 60);

  if (diffMinutes >= 0 && diffMinutes <= 15) {
    return [{ id: "quick-start", data: { minutesAfterStart: Math.round(diffMinutes) } }];
  }
  return [];
};

const checkSpeedRunner: Checker = (ctx) => {
  if (!ctx.hackathonStartTime || !ctx.git.firstCommitAt) return [];

  const start = new Date(ctx.hackathonStartTime).getTime();
  const firstCommit = new Date(ctx.git.firstCommitAt).getTime();
  const diffHours = (firstCommit - start) / (1000 * 60 * 60);

  if (diffHours <= 1 && ctx.score.implementation.total >= 15) {
    return [{ id: "speed-runner" }];
  }
  return [];
};

// first-to-ship: skipped in auto evaluation as per spec

// ---------------------------------------------------------------------------
// 9. Fun checkers
// ---------------------------------------------------------------------------
const checkCopyPasta: Checker = (ctx) => {
  if (ctx.git.totalCommits < 3) return [];
  // Heuristic: check if any file has substantial additions in a commit
  // or look at files changed for large files (use git data)
  const largeCommits = ctx.git.commits.filter((c) => c.additions > 500);
  if (largeCommits.length > 0) {
    return [{ id: "copy-pasta" }];
  }
  return [];
};

const checkReadmeWarrior: Checker = (ctx) => {
  // Count commits that touched README
  const readmeCommits = ctx.git.commits.filter(c =>
    c.files.some(f => f.toLowerCase().includes("readme"))
  ).length;
  // Need to have actively worked on README, not just template
  if (readmeCommits >= 3) {
    return [{ id: "readme-warrior", data: { readmeCommits } }];
  }
  return [];
};

const checkGitFlow: Checker = (_ctx) => {
  // Skip in auto evaluation - would need branch count info not available
  return [];
};

const checkOnePromptWonder: Checker = (ctx) => {
  const sorted = [...ctx.git.commits]
    .filter((c) => c.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].additions + sorted[i].deletions >= 500) {
      // Check if no commit follows within 30 minutes
      if (i === sorted.length - 1) {
        // Last commit, so no follow-up
        return [{ id: "one-prompt-wonder" }];
      }
      const currentTime = new Date(sorted[i].date).getTime();
      const nextTime = new Date(sorted[i + 1].date).getTime();
      if (nextTime - currentTime >= 30 * 60 * 1000) {
        return [{ id: "one-prompt-wonder" }];
      }
    }
  }
  return [];
};

const checkPerfectionist: Checker = (ctx) => {
  const sorted = [...ctx.git.commits]
    .filter((c) => c.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const fixPattern = /\b(fix|refactor)\b/i;

  // Find first "big" commit (100+ lines)
  const bigIdx = sorted.findIndex((c) => c.additions + c.deletions >= 100);
  if (bigIdx === -1) return [];

  const fixCount = sorted
    .slice(bigIdx + 1)
    .filter((c) => fixPattern.test(c.message)).length;

  if (fixCount >= 5) {
    return [{ id: "perfectionist", data: { fixCommits: fixCount } }];
  }
  return [];
};

// easter-egg-hunter: MANUAL ONLY - skip in auto evaluation

// ---------------------------------------------------------------------------
// 10. Collaboration checkers
// ---------------------------------------------------------------------------
const checkFullSquad: Checker = (ctx) => {
  // Count commits per author
  const commitsByAuthor: Record<string, number> = {};
  for (const commit of ctx.git.commits) {
    if (commit.author) {
      commitsByAuthor[commit.author] = (commitsByAuthor[commit.author] ?? 0) + 1;
    }
  }
  const activeAuthors = Object.values(commitsByAuthor).filter((count) => count >= 3).length;
  if (activeAuthors >= 4) {
    return [{ id: "full-squad", data: { activeAuthors } }];
  }
  return [];
};

// ---------------------------------------------------------------------------
// All checkers registry
// ---------------------------------------------------------------------------
const ALL_CHECKERS: Checker[] = [
  // Multi-level threshold
  checkCommitLevels,
  checkRuleLevels,
  checkSkillLevels,
  checkCommandLevels,
  checkCursorEventLevels,
  checkPromptLevels,

  // Git pattern
  checkNightOwl,
  checkCleanHistory,
  checkRefactorKing,
  checkAtomicHabits,
  checkBigBang,
  checkPoet,
  checkShakespeare,
  checkMarathonRunner,

  // AI review
  checkFirstBlood,
  checkGameOn,
  checkFullHouse,
  checkBeyondRules,
  checkMasterpiece,
  checkZeroBug,
  checkEyeCandy,
  checkTypescriptPurist,
  checkTestArchitect,
  checkDocWriter,

  // Package.json
  checkOverkill,
  checkMinimalist,
  checkPixelPerfect,
  checkDarkSide,
  checkResponsiveHero,
  checkAccessible,

  // Cursor
  checkToolCollector,
  checkMcpExplorer,
  checkSpeedCoder,
  checkTabMaster,
  checkMultiModel,
  checkConferenceCall,

  // Agentic combo
  checkPromptArchitect,
  checkPromptEngineer,

  // Relative
  checkFeatureHunter,
  checkPointMachine,

  // Time-based
  checkQuickStart,
  checkSpeedRunner,

  // Fun
  checkCopyPasta,
  checkReadmeWarrior,
  checkGitFlow,
  checkOnePromptWonder,
  checkPerfectionist,

  // Collaboration
  checkFullSquad,
];

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------
export function evaluateAchievements(
  ctx: AchievementEvalContext,
): { id: string; data?: Record<string, unknown> }[] {
  const previousSet = new Set(ctx.previouslyUnlocked);
  const allEarned: EarnedAchievement[] = [];

  for (const checker of ALL_CHECKERS) {
    const results = checker(ctx);
    allEarned.push(...results);
  }

  // Filter out previously unlocked achievements
  return allEarned.filter((a) => !previousSet.has(a.id));
}
