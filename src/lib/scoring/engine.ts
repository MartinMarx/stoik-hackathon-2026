import type {
  ScoreBreakdown,
  CursorStructure,
  CursorMetricsData,
  GitMetrics,
  AIReviewResult,
  AgenticQualityScores,
  FeatureComplianceResult,
  HackathonFeature,
} from "@/types";
import { getCommitRegularity } from "@/lib/analyzers/git";
import { DEFAULT_SKILLS } from "@/lib/analyzers/cursor-structure";

function logScale(count: number, cap: number, factor: number): number {
  if (count <= 0) return 0;
  return Math.min(cap, Math.log2(count + 1) * factor);
}

const MAX = {
  implementation: 40,
  codeQuality: 20,
  gitActivity: 10,
  cursorActivity: 30,
};

const MEANINGFUL_COMMIT_MSG = /^(wip|fix|update|test|asdf|tmp)$/i;
const MIN_COMMIT_MSG_LEN = 10;

function countMeaningfulCommits(git: GitMetrics): number {
  return git.commits.filter((c) => {
    const msg = (c.message ?? "").trim();
    if (msg.length < MIN_COMMIT_MSG_LEN) return false;
    const firstWord = msg.split(/\s+/)[0] ?? "";
    return !MEANINGFUL_COMMIT_MSG.test(firstWord);
  }).length;
}

export function calculateScore(
  cursor: CursorStructure,
  cursorMetrics: CursorMetricsData,
  git: GitMetrics,
  aiReview: AIReviewResult,
  featuresCompliance?: FeatureComplianceResult[],
  features?: HackathonFeature[],
  agenticQuality?: AgenticQualityScores,
): ScoreBreakdown {
  const round = (n: number) => Math.round(n);

  // ---- Implementation (max 40) ----
  const totalRules = aiReview.rulesImplemented.length;
  const pointsPerRule = totalRules > 0 ? 30 / totalRules : 0;

  const rulesComplete = round(
    aiReview.rulesImplemented.filter((r) => r.status === "complete").length *
      pointsPerRule,
  );
  const rulesPartial = round(
    aiReview.rulesImplemented.filter((r) => r.status === "partial").length *
      pointsPerRule *
      0.5,
  );
  const completeRulesCount = aiReview.rulesImplemented.filter(
    (r) => r.status === "complete",
  ).length;
  const minRulesForCreative = 5;
  const creative =
    completeRulesCount >= minRulesForCreative
      ? round(
          Math.min(10, aiReview.bonusFeatures.length * 2 + aiReview.uxScore),
        )
      : 0;
  const implementationTotal = round(
    Math.min(MAX.implementation, rulesComplete + rulesPartial + creative),
  );

  const implementation = {
    total: implementationTotal,
    rulesComplete,
    rulesPartial,
    creative,
  };

  // ---- Code Quality (max 20) ----
  const codeQualityScoreRaw = aiReview.codeQualityScore;
  const codeQualityScore = round(
    Math.min(MAX.codeQuality, (codeQualityScoreRaw / 15) * MAX.codeQuality),
  );
  const typescript = round(codeQualityScore * 0.4);
  const tests = round(codeQualityScore * 0.3);
  const structure = round(codeQualityScore * 0.3);
  const codeQualityTotal = codeQualityScore;

  const codeQuality = {
    total: codeQualityTotal,
    typescript,
    tests,
    structure,
  };

  // ---- Git Activity (max 10) ----
  const meaningfulCommits = countMeaningfulCommits(git);
  const gitCommits = Math.min(4, Math.floor(meaningfulCommits / 40));
  const gitContributors = Math.min(3, git.authors.length);
  const gitRegularity = round(getCommitRegularity(git.commits) * 3);
  const gitTotal = round(
    Math.min(MAX.gitActivity, gitCommits + gitContributors + gitRegularity),
  );

  const gitActivity = {
    total: gitTotal,
    commits: gitCommits,
    contributors: gitContributors,
    regularity: gitRegularity,
  };

  const rulesCount = cursor.rulesCount;
  const skillsCount = cursor.skillsCount;
  const commandsCount = cursor.commandsCount;

  let agenticRules: number;
  let agenticSkills: number;
  let agenticCommands: number;

  if (
    agenticQuality &&
    (agenticQuality.rules.length > 0 ||
      agenticQuality.skills.length > 0 ||
      agenticQuality.commands.length > 0)
  ) {
    const avg = (scores: { quality: number; relevance: number }[]) =>
      scores.length === 0
        ? 0.5
        : scores.reduce((s, x) => s + x.quality * 0.4 + x.relevance * 0.6, 0) /
          scores.length;
    const rulesAvg = avg(agenticQuality.rules) / 10;
    const skillsAvg = avg(agenticQuality.skills) / 10;
    const commandsAvg = avg(agenticQuality.commands) / 10;
    agenticRules = round(
      Math.min(
        8,
        logScale(rulesCount, 8, 4) *
          (agenticQuality.rules.length ? rulesAvg : 0.5),
      ),
    );
    agenticSkills = round(
      Math.min(
        10,
        logScale(skillsCount, 10, 4) *
          (agenticQuality.skills.length ? skillsAvg : 0.5),
      ),
    );
    agenticCommands = round(
      Math.min(
        5,
        logScale(commandsCount, 5, 2.5) *
          (agenticQuality.commands.length ? commandsAvg : 0.5),
      ),
    );
  } else {
    agenticRules = round(Math.min(8, logScale(rulesCount, 8, 4)));
    agenticSkills = round(Math.min(10, logScale(skillsCount, 10, 4)));
    agenticCommands = round(Math.min(5, logScale(commandsCount, 5, 2.5)));
  }

  const agenticTotal = agenticRules + agenticSkills + agenticCommands;

  const prompts = round(
    Math.min(4, Math.log2(1 + cursorMetrics.totalPrompts / 40) * 2),
  );
  const toolDiversity = Math.min(
    3,
    Math.floor(Object.keys(cursorMetrics.toolUseBreakdown).length / 2),
  );
  const sessions = Math.min(3, cursorMetrics.totalSessions);
  const models = Math.min(2, cursorMetrics.modelsUsed.length);
  const mcpBonus = cursorMetrics.mcpExecutionsCount > 0 ? 3 : 0;
  const usageTotal = prompts + toolDiversity + sessions + models + mcpBonus;

  const cursorActivityTotal = round(
    Math.min(MAX.cursorActivity, agenticTotal + usageTotal),
  );

  const cursorActivity = {
    total: cursorActivityTotal,
    rules: agenticRules,
    skills: agenticSkills,
    commands: agenticCommands,
    prompts,
    toolDiversity,
    sessions,
    models,
  };

  const result: ScoreBreakdown = {
    implementation,
    codeQuality,
    gitActivity,
    cursorActivity,
  };

  if (features && featuresCompliance) {
    const announcedFeatures = features.filter((f) => f.status === "announced");
    const announcedTotal = announcedFeatures.reduce(
      (sum, f) => sum + f.points,
      0,
    );

    let implementedPoints = 0;
    for (const compliance of featuresCompliance) {
      const feature = features.find((f) => f.id === compliance.featureId);
      if (!feature) continue;

      if (compliance.status === "implemented") {
        implementedPoints += feature.points;
      } else if (compliance.status === "partial") {
        implementedPoints += feature.points * 0.5;
      }
    }

    result.bonusFeatures = {
      total: round(implementedPoints),
      implemented: round(implementedPoints),
      announced: round(announcedTotal),
    };
  }

  return result;
}

export function getFeatureScore(breakdown: ScoreBreakdown): number {
  return Math.round(
    breakdown.implementation.total +
      breakdown.codeQuality.total +
      breakdown.gitActivity.total +
      breakdown.cursorActivity.total +
      (breakdown.bonusFeatures?.total ?? 0),
  );
}

export function getTotalScore(breakdown: ScoreBreakdown): number {
  let total =
    breakdown.implementation.total +
    breakdown.codeQuality.total +
    breakdown.gitActivity.total +
    breakdown.cursorActivity.total;

  if (breakdown.bonusFeatures) {
    total += breakdown.bonusFeatures.total;
  }
  total += breakdown.achievementBonus?.total ?? 0;

  return Math.round(total);
}

export function getMaxPossibleScore(features?: HackathonFeature[]): number {
  let base = 100;

  if (features) {
    const announcedPoints = features
      .filter((f) => f.status === "announced")
      .reduce((sum, f) => sum + f.points, 0);
    base += announcedPoints;
  }

  return base;
}
