import type {
  ScoreBreakdown,
  CursorStructure,
  CursorMetricsData,
  GitMetrics,
  AIReviewResult,
  FeatureComplianceResult,
  HackathonFeature,
} from "@/types";
import { getCommitRegularity } from "@/lib/analyzers/git";

const MAX = {
  implementation: 35,
  agentic: 25,
  codeQuality: 15,
  gitActivity: 10,
  cursorUsage: 15,
};

export function calculateScore(
  cursor: CursorStructure,
  cursorMetrics: CursorMetricsData,
  git: GitMetrics,
  aiReview: AIReviewResult,
  featuresCompliance?: FeatureComplianceResult[],
  features?: HackathonFeature[],
): ScoreBreakdown {
  const round = (n: number) => Math.round(n);

  // ---- Implementation (max 35) ----
  const totalRules = aiReview.rulesImplemented.length;
  const pointsPerRule = totalRules > 0 ? 25 / totalRules : 0;

  const rulesComplete = round(
    aiReview.rulesImplemented.filter((r) => r.status === "complete").length *
      pointsPerRule,
  );
  const rulesPartial = round(
    aiReview.rulesImplemented.filter((r) => r.status === "partial").length *
      pointsPerRule *
      0.5,
  );
  const creative = round(
    Math.min(10, aiReview.bonusFeatures.length * 2 + aiReview.uxScore),
  );
  const implementationTotal = round(
    Math.min(MAX.implementation, rulesComplete + rulesPartial + creative),
  );

  const implementation = {
    total: implementationTotal,
    rulesComplete,
    rulesPartial,
    creative,
  };

  // ---- Agentic (max 25) ----
  const agenticRules = round(Math.min(10, cursor.rulesCount * 2.5));
  const skillsBonus = cursor.skills.some((s) => s.contentLength > 500) ? 2 : 0;
  const agenticSkills = round(
    Math.min(10, cursor.skillsCount * 2.5 + skillsBonus),
  );
  const agenticCommands = round(Math.min(5, cursor.commandsCount * 2));
  const agenticTotal = round(
    Math.min(MAX.agentic, agenticRules + agenticSkills + agenticCommands),
  );

  const agentic = {
    total: agenticTotal,
    rules: agenticRules,
    skills: agenticSkills,
    commands: agenticCommands,
  };

  // ---- Code Quality (max 15) ----
  const codeQualityScore = aiReview.codeQualityScore;
  const typescript = round(codeQualityScore * 0.4);
  const tests = round(codeQualityScore * 0.3);
  const structure = round(codeQualityScore * 0.3);
  const codeQualityTotal = round(Math.min(MAX.codeQuality, codeQualityScore));

  const codeQuality = {
    total: codeQualityTotal,
    typescript,
    tests,
    structure,
  };

  // ---- Git Activity (max 10) ----
  const gitCommits = Math.min(4, Math.floor(git.totalCommits / 15));
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

  // ---- Cursor Usage (max 15) ----
  const prompts = Math.min(4, Math.floor(cursorMetrics.totalPrompts / 50));
  const toolDiversity = Math.min(
    3,
    Math.floor(Object.keys(cursorMetrics.toolUseBreakdown).length / 2),
  );
  const sessions = Math.min(3, cursorMetrics.totalSessions);
  const models = Math.min(2, cursorMetrics.modelsUsed.length);
  const mcpBonus = cursorMetrics.mcpExecutionsCount > 0 ? 3 : 0;
  const cursorUsageTotal = round(
    Math.min(
      MAX.cursorUsage,
      prompts + toolDiversity + sessions + models + mcpBonus,
    ),
  );

  const cursorUsage = {
    total: cursorUsageTotal,
    prompts,
    toolDiversity,
    sessions,
    models,
  };

  // ---- Bonus Features (variable, optional) ----
  const result: ScoreBreakdown = {
    implementation,
    agentic,
    codeQuality,
    gitActivity,
    cursorUsage,
  };

  if (features && featuresCompliance) {
    const announcedFeatures = features.filter((f) => f.status === "announced");
    const announcedTotal = announcedFeatures.reduce(
      (sum, f) => sum + f.points,
      0,
    );

    let implementedPoints = 0;
    for (const compliance of featuresCompliance) {
      if (compliance.status === "implemented") {
        const feature = features.find((f) => f.id === compliance.featureId);
        if (feature) {
          implementedPoints += feature.points;
        }
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

export function getTotalScore(breakdown: ScoreBreakdown): number {
  let total =
    breakdown.implementation.total +
    breakdown.agentic.total +
    breakdown.codeQuality.total +
    breakdown.gitActivity.total +
    breakdown.cursorUsage.total;

  if (breakdown.bonusFeatures) {
    total += breakdown.bonusFeatures.total;
  }

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
