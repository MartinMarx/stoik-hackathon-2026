import type {
  AIReviewResult,
  AgenticQualityScores,
  FeatureComplianceResult,
} from "@/types";
import type { InjectionReport } from "./sanitizer";
import type { SubstanceMetrics } from "./substance-check";

// ---------------------------------------------------------------------------
// Review result validation
// ---------------------------------------------------------------------------

const VALID_RULE_STATUSES = new Set(["complete", "partial", "missing"]);
const VALID_FEATURE_STATUSES = new Set(["implemented", "partial", "missing"]);

export function validateReviewResult(
  result: AIReviewResult,
  substance: SubstanceMetrics,
  injectionReport?: InjectionReport,
): AIReviewResult {
  let validated = clampReviewResult(result);
  validated = checkSuspiciousPatterns(validated, substance);

  if (injectionReport && injectionReport.highSeverityCount > 0) {
    validated = applyInjectionPenalty(validated, injectionReport);
  }

  return validated;
}

/**
 * Enforce hard bounds on all numeric fields and enum values.
 */
function clampReviewResult(result: AIReviewResult): AIReviewResult {
  const codeQualityScore = clamp(result.codeQualityScore ?? 0, 0, 15);
  const uxScore = clamp(result.uxScore ?? 0, 0, 10);

  const rulesImplemented = (result.rulesImplemented ?? []).map((r) => ({
    ...r,
    status: VALID_RULE_STATUSES.has(r.status) ? r.status : ("missing" as const),
    confidence: clamp(
      r.confidence > 1 ? r.confidence / 100 : r.confidence,
      0,
      1,
    ),
  }));

  return {
    ...result,
    rulesImplemented,
    codeQualityScore,
    uxScore,
    bonusFeatures: result.bonusFeatures ?? [],
    recommendations: (result.recommendations ?? []).slice(0, 5),
  };
}

/**
 * Detect suspiciously perfect or uniform AI outputs that suggest
 * the model was influenced by prompt injection.
 */
function checkSuspiciousPatterns(
  result: AIReviewResult,
  substance: SubstanceMetrics,
): AIReviewResult {
  const rules = [...result.rulesImplemented];
  let { codeQualityScore, uxScore } = result;

  const completeRules = rules.filter((r) => r.status === "complete");
  const totalRules = rules.length;

  // Flag 1: Suspiciously high completion rate with small codebase
  if (
    totalRules > 0 &&
    completeRules.length / totalRules > 0.8 &&
    substance.codeLines < 300
  ) {
    console.warn(
      `[output-validator] Suspicious: ${completeRules.length}/${totalRules} rules complete but only ${substance.codeLines} code lines`,
    );
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].status === "complete") {
        rules[i] = {
          ...rules[i],
          confidence: Math.min(rules[i].confidence, 0.6),
        };
      }
    }
  }

  // Flag 2: All confidences are identical (AI was likely manipulated)
  const confidences = rules
    .filter((r) => r.status !== "missing")
    .map((r) => r.confidence);
  if (confidences.length > 5) {
    const allSame = confidences.every((c) => c === confidences[0]);
    if (allSame && confidences[0] > 0.7) {
      console.warn(
        `[output-validator] Suspicious: all ${confidences.length} non-missing rule confidences identical at ${confidences[0]}`,
      );
      for (let i = 0; i < rules.length; i++) {
        if (rules[i].status !== "missing") {
          rules[i] = {
            ...rules[i],
            confidence: Math.min(rules[i].confidence, 0.7),
          };
        }
      }
    }
  }

  // Flag 3: High code quality score but low substance
  if (codeQualityScore > 12 && substance.codeLines < 500) {
    console.warn(
      `[output-validator] Capping code quality: score ${codeQualityScore} but only ${substance.codeLines} code lines`,
    );
    codeQualityScore = Math.min(codeQualityScore, 8);
  }

  // Flag 4: Many complete rules but most files are empty/tiny
  if (
    completeRules.length > 8 &&
    substance.emptyFileCount > substance.totalFiles * 0.4
  ) {
    console.warn(
      `[output-validator] Suspicious: ${completeRules.length} complete rules but ${substance.emptyFileCount}/${substance.totalFiles} files are near-empty`,
    );
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].status === "complete") {
        rules[i] = { ...rules[i], status: "partial" as const };
      }
    }
  }

  // Flag 5: High UX score with very little code
  if (uxScore > 8 && substance.codeLines < 300) {
    uxScore = Math.min(uxScore, 5);
  }

  return {
    ...result,
    rulesImplemented: rules,
    codeQualityScore,
    uxScore,
  };
}

/**
 * Apply a penalty when injection attempts were detected.
 * The penalty scales with severity count.
 */
function applyInjectionPenalty(
  result: AIReviewResult,
  report: InjectionReport,
): AIReviewResult {
  const highCount = report.highSeverityCount;
  if (highCount === 0) return result;

  // Scale: 1-2 high flags = 0.9x, 3-5 = 0.8x, 6+ = 0.7x
  const factor = highCount <= 2 ? 0.9 : highCount <= 5 ? 0.8 : 0.7;

  console.warn(
    `[output-validator] Applying injection penalty: factor=${factor} for ${highCount} high-severity flags`,
  );

  const qualityPenalty = Math.max(
    0,
    Math.round(result.codeQualityScore * factor),
  );

  const rules = result.rulesImplemented.map((r) => ({
    ...r,
    confidence: Math.round(r.confidence * factor * 100) / 100,
  }));

  return {
    ...result,
    rulesImplemented: rules,
    codeQualityScore: qualityPenalty,
  };
}

// ---------------------------------------------------------------------------
// Agentic quality validation
// ---------------------------------------------------------------------------

export function validateAgenticScores(
  scores: AgenticQualityScores,
  items: { type: string; name: string; content: string }[],
): AgenticQualityScores {
  const itemMap = new Map(items.map((it) => [`${it.type}:${it.name}`, it]));

  const validateList = (
    list: AgenticQualityScores["rules"],
    type: string,
  ): AgenticQualityScores["rules"] =>
    list.map((entry) => {
      let { quality, relevance } = entry;
      const item = itemMap.get(`${type}:${entry.name}`);
      const contentLen = item?.content.trim().length ?? 0;

      // Near-empty files can't be high quality
      if (contentLen < 50) {
        quality = Math.min(quality, 2);
        relevance = Math.min(relevance, 2);
      }

      return {
        name: entry.name,
        quality: clamp(quality, 0, 10),
        relevance: clamp(relevance, 0, 10),
      };
    });

  const rules = validateList(scores.rules, "rule");
  const skills = validateList(scores.skills, "skill");
  const commands = validateList(scores.commands, "command");

  // Check for suspiciously uniform perfect scores
  const all = [...rules, ...skills, ...commands];
  const allPerfect =
    all.length > 3 && all.every((e) => e.quality >= 9 && e.relevance >= 9);
  if (allPerfect) {
    console.warn(
      `[output-validator] Suspicious: all ${all.length} agentic scores are near-perfect, capping to 7`,
    );
    const cap = (
      list: AgenticQualityScores["rules"],
    ): AgenticQualityScores["rules"] =>
      list.map((e) => ({
        ...e,
        quality: Math.min(e.quality, 7),
        relevance: Math.min(e.relevance, 7),
      }));
    return recalcAverage({
      rules: cap(rules),
      skills: cap(skills),
      commands: cap(commands),
      averageScore: 0,
    });
  }

  return recalcAverage({ rules, skills, commands, averageScore: 0 });
}

function recalcAverage(scores: AgenticQualityScores): AgenticQualityScores {
  const all = [...scores.rules, ...scores.skills, ...scores.commands];
  if (all.length === 0) return { ...scores, averageScore: 0 };
  const sum = all.reduce((s, e) => s + e.quality * 0.4 + e.relevance * 0.6, 0);
  return {
    ...scores,
    averageScore: Math.round((sum / all.length) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Feature compliance validation
// ---------------------------------------------------------------------------

export function validateFeatureCompliance(
  results: FeatureComplianceResult[],
  substance: SubstanceMetrics,
): FeatureComplianceResult[] {
  return results.map((r) => {
    let { status, confidence } = r;

    // Normalize confidence
    confidence = confidence > 1 ? confidence / 100 : confidence;
    confidence = clamp(confidence, 0, 1);

    // Validate status
    if (!VALID_FEATURE_STATUSES.has(status)) {
      status = "missing";
    }

    // Very small codebases can't realistically implement many bonus features
    if (status === "implemented" && substance.codeLines < 200) {
      confidence = Math.min(confidence, 0.5);
    }

    return { ...r, status, confidence } as FeatureComplianceResult;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
