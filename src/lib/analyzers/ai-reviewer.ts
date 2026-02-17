import Anthropic from "@anthropic-ai/sdk";
import type { AIReviewResult, FeatureComplianceResult, HackathonFeature } from "@/types";
import { GAME_RULES, GAME_RULES_CHECKLIST } from "@/lib/game-rules";

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------
const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max chars per chunk sent to a single Claude call */
const CHUNK_SIZE = 100_000;

/** File extensions ordered by review priority */
const PRIORITY_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function sortByPriority(
  files: { path: string; content: string }[],
): { path: string; content: string }[] {
  return [...files].sort((a, b) => {
    const aIdx = PRIORITY_EXTENSIONS.findIndex((ext) => a.path.endsWith(ext));
    const bIdx = PRIORITY_EXTENSIONS.findIndex((ext) => b.path.endsWith(ext));
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });
}

function filesToText(files: { path: string; content: string }[]): string {
  return files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");
}

/**
 * Split source files into chunks that fit within CHUNK_SIZE chars each.
 * Each chunk is a self-contained text block of concatenated files.
 */
function chunkFiles(
  files: { path: string; content: string }[],
): { path: string; content: string }[][] {
  const chunks: { path: string; content: string }[][] = [];
  let currentChunk: { path: string; content: string }[] = [];
  let currentSize = 0;

  for (const file of files) {
    const entrySize = file.path.length + file.content.length + 10;

    if (currentSize + entrySize > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }

    // If a single file exceeds CHUNK_SIZE, truncate it
    if (entrySize > CHUNK_SIZE) {
      currentChunk.push({
        path: file.path,
        content: file.content.slice(0, CHUNK_SIZE - 200) + "\n[file truncated]",
      });
      chunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    } else {
      currentChunk.push(file);
      currentSize += entrySize;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function defaultReviewResult(): AIReviewResult {
  return {
    rulesImplemented: GAME_RULES_CHECKLIST.map((item) => ({
      rule: item.rule,
      status: "missing" as const,
      confidence: 0,
    })),
    codeQualityScore: 0,
    bugs: [],
    bonusFeatures: [],
    uxScore: 0,
    recommendations: [],
  };
}

// ---------------------------------------------------------------------------
// Tool definitions for structured output
// ---------------------------------------------------------------------------

const CODE_REVIEW_TOOL: Anthropic.Tool = {
  name: "code_review",
  description: "Submit the structured code review results.",
  input_schema: {
    type: "object" as const,
    properties: {
      rulesImplemented: {
        type: "array",
        description: "Evaluation of each of the 15 game rules.",
        items: {
          type: "object",
          properties: {
            rule: { type: "string" },
            status: { type: "string", enum: ["complete", "partial", "missing"] },
            confidence: { type: "number" },
            details: { type: "string" },
          },
          required: ["rule", "status", "confidence"],
        },
      },
      codeQualityScore: { type: "number", description: "0-15" },
      bugs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            file: { type: "string" },
            line: { type: "number" },
            description: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["file", "description", "severity"],
        },
      },
      bonusFeatures: { type: "array", items: { type: "string" } },
      uxScore: { type: "number", description: "0-10" },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["rulesImplemented", "codeQualityScore", "bugs", "bonusFeatures", "uxScore", "recommendations"],
  },
};

const CHUNK_REVIEW_TOOL: Anthropic.Tool = {
  name: "chunk_review",
  description: "Submit partial review findings for this code chunk.",
  input_schema: {
    type: "object" as const,
    properties: {
      rulesEvidence: {
        type: "array",
        description: "Evidence of game rule implementation found in this chunk.",
        items: {
          type: "object",
          properties: {
            ruleId: { type: "string", description: "Rule ID from the checklist." },
            evidence: { type: "string", description: "What was found." },
            status: { type: "string", enum: ["complete", "partial", "missing"] },
            confidence: { type: "number" },
          },
          required: ["ruleId", "evidence", "status", "confidence"],
        },
      },
      qualityNotes: { type: "string", description: "Code quality observations." },
      bugs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            file: { type: "string" },
            line: { type: "number" },
            description: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["file", "description", "severity"],
        },
      },
      bonusFeatures: { type: "array", items: { type: "string" } },
      uxNotes: { type: "string", description: "UX/design observations." },
    },
    required: ["rulesEvidence", "qualityNotes", "bugs", "bonusFeatures", "uxNotes"],
  },
};

const FEATURE_COMPLIANCE_TOOL: Anthropic.Tool = {
  name: "feature_compliance",
  description: "Submit the feature compliance check results.",
  input_schema: {
    type: "object" as const,
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            featureId: { type: "string" },
            featureTitle: { type: "string" },
            status: { type: "string", enum: ["implemented", "partial", "missing"] },
            confidence: { type: "number" },
            details: { type: "string" },
          },
          required: ["featureId", "featureTitle", "status", "confidence"],
        },
      },
    },
    required: ["results"],
  },
};

// ---------------------------------------------------------------------------
// Chunk review types
// ---------------------------------------------------------------------------

interface ChunkReviewResult {
  rulesEvidence: { ruleId: string; evidence: string; status: string; confidence: number }[];
  qualityNotes: string;
  bugs: { file: string; line?: number; description: string; severity: "low" | "medium" | "high" }[];
  bonusFeatures: string[];
  uxNotes: string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildFullReviewPrompt(
  sourceCode: string,
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
  bonusFeatures: HackathonFeature[],
): string {
  const rulesChecklist = GAME_RULES_CHECKLIST.map(
    (item, i) => `${i + 1}. [${item.id}] ${item.rule}`,
  ).join("\n");

  const announcedFeatures = bonusFeatures.filter((f) => f.status === "announced");
  const bonusFeaturesText =
    announcedFeatures.length > 0
      ? announcedFeatures
          .map(
            (f) =>
              `- ${f.title} (${f.difficulty}, ${f.points}pts): ${f.description}\n  Criteria: ${f.criteria.join("; ")}`,
          )
          .join("\n")
      : "No bonus features announced yet.";

  const depsText = packageJson
    ? `Dependencies:\n${JSON.stringify(packageJson.dependencies, null, 2)}\n\nDev Dependencies:\n${JSON.stringify(packageJson.devDependencies, null, 2)}`
    : "No package.json available.";

  return `You are a senior code reviewer evaluating a hackathon team's submission for "Among Us for Coders" — a multiplayer social deduction game where players collaborate to fix broken TypeScript code while trying to identify an impostor.

## Game Rules (Full Reference)

${GAME_RULES}

## Rules Checklist (15 items to evaluate)

${rulesChecklist}

## Bonus Features to Check

${bonusFeaturesText}

## Package Dependencies

${depsText}

## Source Code

${sourceCode}

## Your Task

Think deeply about this codebase. Then call the \`code_review\` tool with your structured review:

1. **rulesImplemented**: For EACH of the 15 game rules, evaluate whether it is implemented:
   - "complete": Fully implemented and functional
   - "partial": Some aspects present but not all
   - "missing": No evidence
   - Provide confidence 0.0-1.0 and details

2. **codeQualityScore**: Rate 0-15 (TypeScript, error handling, structure, naming, tests, engineering quality)

3. **bugs**: Identify bugs (file, optional line, description, severity: low/medium/high)

4. **bonusFeatures**: Creative features beyond the 15 base game rules

5. **uxScore**: Rate 0-10 (UI quality, responsiveness, animations, accessibility)

6. **recommendations**: 3-5 actionable improvements

Be thorough but fair. Give credit where code shows clear intent even if implementation is incomplete.`;
}

// ---------------------------------------------------------------------------
// Strategy 1: FULL REVIEW (first analysis or manual trigger)
//
// For small codebases (fits in one chunk): single Opus call with thinking.
// For large codebases: parallel chunk reviews (Sonnet) → synthesis (Opus).
// ---------------------------------------------------------------------------

export async function reviewCode(
  sourceFiles: { path: string; content: string }[],
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
  bonusFeatures: HackathonFeature[],
): Promise<AIReviewResult> {
  try {
    const sorted = sortByPriority(sourceFiles);
    const chunks = chunkFiles(sorted);

    if (chunks.length <= 1) {
      // Small codebase: single deep review with Opus + thinking
      return singlePassReview(sorted, packageJson, bonusFeatures);
    }

    // Large codebase: parallel chunk reviews → synthesis
    return chunkedReview(chunks, sorted, packageJson, bonusFeatures);
  } catch (error) {
    console.error("[ai-reviewer] Review failed:", error);
    return defaultReviewResult();
  }
}

/**
 * Single-pass review for small codebases. Uses Opus 4.6 with extended
 * thinking for maximum quality.
 */
async function singlePassReview(
  files: { path: string; content: string }[],
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
  bonusFeatures: HackathonFeature[],
): Promise<AIReviewResult> {
  const sourceCode = filesToText(files);
  const prompt = buildFullReviewPrompt(sourceCode, packageJson, bonusFeatures);

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    tools: [CODE_REVIEW_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: prompt }],
  });

  return extractReviewResult(response);
}

/**
 * Multi-chunk review for large codebases.
 * 1. Review each chunk in parallel with Sonnet (fast/cheap)
 * 2. Synthesize all chunk results with Opus + thinking (accurate)
 */
async function chunkedReview(
  chunks: { path: string; content: string }[][],
  allFiles: { path: string; content: string }[],
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
  bonusFeatures: HackathonFeature[],
): Promise<AIReviewResult> {
  console.log(`[ai-reviewer] Large codebase: splitting into ${chunks.length} chunks`);

  // Step 1: Review each chunk in parallel with Sonnet
  const chunkResults = await Promise.all(
    chunks.map((chunk, i) => reviewChunk(chunk, i, chunks.length)),
  );

  // Step 2: Synthesize with Opus
  return synthesizeChunkResults(chunkResults, allFiles, packageJson, bonusFeatures);
}

/**
 * Review a single chunk of source code using Sonnet 4.5 (fast).
 * Returns partial findings to be merged later.
 */
async function reviewChunk(
  files: { path: string; content: string }[],
  chunkIndex: number,
  totalChunks: number,
): Promise<ChunkReviewResult> {
  const sourceCode = filesToText(files);

  const rulesChecklist = GAME_RULES_CHECKLIST.map(
    (item, i) => `${i + 1}. [${item.id}] ${item.rule}`,
  ).join("\n");

  const prompt = `You are reviewing chunk ${chunkIndex + 1}/${totalChunks} of a hackathon project ("Among Us for Coders" — a multiplayer social deduction game).

## Game Rules Checklist
${rulesChecklist}

## Source Code (chunk ${chunkIndex + 1}/${totalChunks})
${sourceCode}

## Task
Analyze this code chunk and call \`chunk_review\` with:
- **rulesEvidence**: For each game rule you find evidence of, note the rule ID, what you found, and your assessment
- **qualityNotes**: Code quality observations (TypeScript usage, patterns, error handling)
- **bugs**: Any bugs found (file, line, description, severity)
- **bonusFeatures**: Creative features beyond base rules
- **uxNotes**: UI/UX observations

Only report on what you actually see in THIS chunk. Don't speculate about code in other chunks.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      tools: [CHUNK_REVIEW_TOOL],
      tool_choice: { type: "tool", name: "chunk_review" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (!toolBlock) {
      return { rulesEvidence: [], qualityNotes: "", bugs: [], bonusFeatures: [], uxNotes: "" };
    }

    return toolBlock.input as ChunkReviewResult;
  } catch (error) {
    console.error(`[ai-reviewer] Chunk ${chunkIndex + 1} review failed:`, error);
    return { rulesEvidence: [], qualityNotes: "", bugs: [], bonusFeatures: [], uxNotes: "" };
  }
}

/**
 * Synthesize parallel chunk results into a final review using Opus 4.6 +
 * extended thinking. Opus gets the aggregated findings + file tree (not full
 * source), so it can reason about the whole picture without context overflow.
 */
async function synthesizeChunkResults(
  chunkResults: ChunkReviewResult[],
  allFiles: { path: string; content: string }[],
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
  bonusFeatures: HackathonFeature[],
): Promise<AIReviewResult> {
  const fileTree = allFiles.map((f) => f.path).join("\n");

  const announcedFeatures = bonusFeatures.filter((f) => f.status === "announced");

  const rulesChecklist = GAME_RULES_CHECKLIST.map(
    (item, i) => `${i + 1}. [${item.id}] ${item.rule}`,
  ).join("\n");

  // Aggregate chunk findings into a readable summary
  const aggregatedEvidence = chunkResults
    .flatMap((r) => r.rulesEvidence)
    .reduce(
      (acc, e) => {
        if (!acc[e.ruleId]) acc[e.ruleId] = [];
        acc[e.ruleId].push(`[${e.status}, confidence=${e.confidence}] ${e.evidence}`);
        return acc;
      },
      {} as Record<string, string[]>,
    );

  const evidenceText = Object.entries(aggregatedEvidence)
    .map(([ruleId, evidences]) => `### ${ruleId}\n${evidences.map((e) => `- ${e}`).join("\n")}`)
    .join("\n\n");

  const allBugs = chunkResults.flatMap((r) => r.bugs);
  const allBonusFeatures = [...new Set(chunkResults.flatMap((r) => r.bonusFeatures))];
  const qualityNotes = chunkResults.map((r, i) => `Chunk ${i + 1}: ${r.qualityNotes}`).filter((n) => n.length > 10).join("\n");
  const uxNotes = chunkResults.map((r, i) => `Chunk ${i + 1}: ${r.uxNotes}`).filter((n) => n.length > 10).join("\n");

  const bonusFeaturesText =
    announcedFeatures.length > 0
      ? announcedFeatures
          .map((f) => `- ${f.title} (${f.difficulty}, ${f.points}pts): ${f.description}`)
          .join("\n")
      : "No bonus features announced yet.";

  const depsText = packageJson
    ? JSON.stringify({ dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies }, null, 2)
    : "No package.json available.";

  const prompt = `You are synthesizing a code review for a hackathon project ("Among Us for Coders"). Multiple reviewers have independently analyzed different parts of the codebase. Your job is to produce the final, authoritative review.

## Game Rules
${GAME_RULES}

## Rules Checklist
${rulesChecklist}

## Bonus Features to Check
${bonusFeaturesText}

## File Tree (${allFiles.length} files)
${fileTree}

## Package Dependencies
${depsText}

## Evidence from Chunk Reviews

${evidenceText || "No rule evidence found in any chunk."}

## Quality Notes
${qualityNotes || "No quality notes."}

## UX Notes
${uxNotes || "No UX notes."}

## Bugs Found (${allBugs.length})
${allBugs.map((b) => `- [${b.severity}] ${b.file}${b.line ? `:${b.line}` : ""}: ${b.description}`).join("\n") || "None"}

## Bonus Features Detected
${allBonusFeatures.join(", ") || "None"}

## Your Task

Based on ALL evidence above, produce the final review by calling \`code_review\`. For rules where multiple chunks provide evidence, synthesize the findings. Where evidence conflicts, use your judgment. Be thorough and fair.

- **rulesImplemented**: Final verdict for each of the 15 rules (complete/partial/missing + confidence + details)
- **codeQualityScore**: 0-15 based on all quality observations
- **bugs**: Deduplicated and validated bug list
- **bonusFeatures**: Confirmed creative features
- **uxScore**: 0-10 based on all UX observations
- **recommendations**: 3-5 actionable improvements`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    tools: [CODE_REVIEW_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: prompt }],
  });

  return extractReviewResult(response);
}

// ---------------------------------------------------------------------------
// Strategy 2: INCREMENTAL REVIEW (diff-based, for subsequent pushes)
//
// Only reviews changed files, then merges findings with previous results.
// Uses Sonnet 4.5 for speed since most diffs are small.
// ---------------------------------------------------------------------------

/**
 * Incremental review: analyze only changed files and merge with previous
 * review results. Much faster and cheaper than a full review.
 *
 * @param changedFiles - Only the files that changed since last analysis
 * @param previousResult - The previous full review result to merge into
 * @param allFilesPaths - Full file tree (paths only) for context
 * @param packageJson - Current package.json
 * @param bonusFeatures - Current bonus features list
 */
export async function reviewCodeIncremental(
  changedFiles: { path: string; content: string }[],
  previousResult: AIReviewResult,
  allFilesPaths: string[],
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
  bonusFeatures: HackathonFeature[],
): Promise<AIReviewResult> {
  if (changedFiles.length === 0) {
    return previousResult;
  }

  try {
    const sorted = sortByPriority(changedFiles);
    const sourceCode = filesToText(sorted);

    // If the diff is very large, fall back to full review
    const totalChars = sourceCode.length;
    if (totalChars > CHUNK_SIZE * 2) {
      console.log("[ai-reviewer] Diff too large, falling back to full review");
      // Caller should detect this and call reviewCode instead
      return reviewCode(changedFiles, packageJson, bonusFeatures);
    }

    const rulesChecklist = GAME_RULES_CHECKLIST.map(
      (item, i) => `${i + 1}. [${item.id}] ${item.rule}`,
    ).join("\n");

    const previousRulesText = previousResult.rulesImplemented
      .map((r) => `- ${r.rule}: ${r.status} (confidence=${r.confidence})${r.details ? ` — ${r.details}` : ""}`)
      .join("\n");

    const announcedFeatures = bonusFeatures.filter((f) => f.status === "announced");
    const bonusFeaturesText =
      announcedFeatures.length > 0
        ? announcedFeatures
            .map((f) => `- ${f.title} (${f.difficulty}, ${f.points}pts): ${f.description}`)
            .join("\n")
        : "No bonus features announced yet.";

    const depsText = packageJson
      ? `Dependencies: ${Object.keys(packageJson.dependencies).join(", ")}\nDev: ${Object.keys(packageJson.devDependencies).join(", ")}`
      : "";

    const prompt = `You are updating a code review for a hackathon project ("Among Us for Coders"). New code has been pushed. Review ONLY the changed files below and update the previous assessment.

## Game Rules Checklist
${rulesChecklist}

## Bonus Features to Check
${bonusFeaturesText}

## Previous Review State
Rules status:
${previousRulesText}

Previous code quality score: ${previousResult.codeQualityScore}/15
Previous UX score: ${previousResult.uxScore}/10
Previous bugs count: ${previousResult.bugs.length}
Previous bonus features: ${previousResult.bonusFeatures.join(", ") || "none"}

## Full File Tree (${allFilesPaths.length} files)
${allFilesPaths.join("\n")}

## ${depsText ? `Package Info\n${depsText}\n\n## ` : ""}Changed Files (${changedFiles.length} files modified)

${sourceCode}

## Task

Call \`code_review\` with the UPDATED review. For each rule:
- If the changed files affect a rule's status, update it with new evidence
- If unchanged by these files, keep the previous assessment
- Look for NEW bugs in the changed files (previous bugs in unchanged files should be kept)
- Update quality/UX scores if the changes warrant it
- Check if any new bonus features were added`;

    // Use Sonnet for incremental (fast), Opus for large diffs
    const isLargeDiff = changedFiles.length > 15 || totalChars > CHUNK_SIZE;
    const model = isLargeDiff ? "claude-opus-4-6" : "claude-sonnet-4-5-20250929";

    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      tools: [CODE_REVIEW_TOOL],
      tool_choice: isLargeDiff ? { type: "auto" } : { type: "tool", name: "code_review" },
      messages: [{ role: "user", content: prompt }],
    });

    const result = extractReviewResult(response);

    // Merge: keep previous bugs for files that weren't changed
    const changedPaths = new Set(changedFiles.map((f) => f.path));
    const keptBugs = previousResult.bugs.filter((b) => !changedPaths.has(b.file));
    result.bugs = [...keptBugs, ...result.bugs];

    return result;
  } catch (error) {
    console.error("[ai-reviewer] Incremental review failed:", error);
    return previousResult; // Keep previous result on failure
  }
}

// ---------------------------------------------------------------------------
// Response extraction helper
// ---------------------------------------------------------------------------

function extractReviewResult(
  response: Anthropic.Message,
): AIReviewResult {
  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUseBlock) {
    console.error("[ai-reviewer] No tool_use block in response");
    return defaultReviewResult();
  }

  const result = toolUseBlock.input as AIReviewResult;

  return {
    rulesImplemented: result.rulesImplemented ?? [],
    codeQualityScore: Math.min(15, Math.max(0, result.codeQualityScore ?? 0)),
    bugs: result.bugs ?? [],
    bonusFeatures: result.bonusFeatures ?? [],
    uxScore: Math.min(10, Math.max(0, result.uxScore ?? 0)),
    recommendations: result.recommendations ?? [],
  };
}

// ---------------------------------------------------------------------------
// Feature compliance check (separate lighter call)
// ---------------------------------------------------------------------------

export async function checkFeatureCompliance(
  sourceFiles: { path: string; content: string }[],
  features: HackathonFeature[],
): Promise<FeatureComplianceResult[]> {
  if (features.length === 0) return [];

  try {
    const sorted = sortByPriority(sourceFiles);
    const chunks = chunkFiles(sorted);

    // If it fits in one call, do it directly
    if (chunks.length <= 1) {
      return singleFeatureCheck(sorted, features);
    }

    // Otherwise: check each chunk in parallel, merge results
    const chunkResults = await Promise.all(
      chunks.map((chunk) => singleFeatureCheck(chunk, features)),
    );

    // Merge: for each feature, take the best status across chunks
    return features.map((f) => {
      const allResults = chunkResults
        .flatMap((r) => r)
        .filter((r) => r.featureId === f.id);

      if (allResults.length === 0) {
        return { featureId: f.id, featureTitle: f.title, status: "missing" as const, confidence: 0 };
      }

      // Priority: implemented > partial > missing
      const statusPriority = { implemented: 3, partial: 2, missing: 1 };
      const best = allResults.reduce((a, b) =>
        (statusPriority[a.status] || 0) > (statusPriority[b.status] || 0) ? a : b,
      );

      return best;
    });
  } catch (error) {
    console.error("[ai-reviewer] Feature compliance check failed:", error);
    return features.map((f) => ({
      featureId: f.id,
      featureTitle: f.title,
      status: "missing" as const,
      confidence: 0,
    }));
  }
}

async function singleFeatureCheck(
  files: { path: string; content: string }[],
  features: HackathonFeature[],
): Promise<FeatureComplianceResult[]> {
  const sourceCode = filesToText(files);

  const featuresText = features
    .map(
      (f) =>
        `- ID: ${f.id}\n  Title: ${f.title}\n  Description: ${f.description}\n  Criteria: ${f.criteria.join("; ")}`,
    )
    .join("\n\n");

  const prompt = `You are evaluating a hackathon team's codebase to determine which bonus features have been implemented.

## Features to Check
${featuresText}

## Source Code
${sourceCode}

## Task
For each feature, determine its implementation status by calling \`feature_compliance\`:
- "implemented": Feature is fully working based on the criteria
- "partial": Some aspects are present but not all criteria are met
- "missing": No evidence of the feature in the code

Provide a confidence score (0.0-1.0) and brief details for each.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    tools: [FEATURE_COMPLIANCE_TOOL],
    tool_choice: { type: "tool", name: "feature_compliance" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );

  if (!toolBlock) {
    return features.map((f) => ({
      featureId: f.id,
      featureTitle: f.title,
      status: "missing" as const,
      confidence: 0,
    }));
  }

  const rawResults = (toolBlock.input as { results: FeatureComplianceResult[] }).results ?? [];

  // Normalize: always use the known feature titles from DB, not the AI's output
  return features.map((f) => {
    const match = rawResults.find((r) => r.featureId === f.id);
    if (!match) {
      return { featureId: f.id, featureTitle: f.title, status: "missing" as const, confidence: 0 };
    }
    return { ...match, featureId: f.id, featureTitle: f.title };
  });
}
