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

/** Max chars for a single chunk of source code sent to Claude */
const MAX_CHUNK_CHARS = 120_000;

/** Max chars for the structural summary pass */
const MAX_SUMMARY_SOURCE_CHARS = 80_000;

// File extensions ordered by priority for truncation
const PRIORITY_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sort source files by relevance (TS/TSX first, then JS, then rest).
 */
function sortByPriority(
  sourceFiles: { path: string; content: string }[],
): { path: string; content: string }[] {
  return [...sourceFiles].sort((a, b) => {
    const aIdx = PRIORITY_EXTENSIONS.findIndex((ext) => a.path.endsWith(ext));
    const bIdx = PRIORITY_EXTENSIONS.findIndex((ext) => b.path.endsWith(ext));
    const aPriority = aIdx === -1 ? PRIORITY_EXTENSIONS.length : aIdx;
    const bPriority = bIdx === -1 ? PRIORITY_EXTENSIONS.length : bIdx;
    return aPriority - bPriority;
  });
}

/**
 * Build a source code string from files, truncating at maxChars.
 */
function buildSourceText(
  files: { path: string; content: string }[],
  maxChars: number,
): { text: string; truncated: boolean; filesIncluded: number } {
  const parts: string[] = [];
  let totalLength = 0;
  let filesIncluded = 0;

  for (const file of files) {
    const entry = `--- ${file.path} ---\n${file.content}\n`;
    if (totalLength + entry.length > maxChars) {
      const remaining = maxChars - totalLength;
      if (remaining > 100) {
        parts.push(
          `--- ${file.path} ---\n${file.content.slice(0, remaining - 50)}\n[file truncated]\n`,
        );
        filesIncluded++;
      }
      parts.push(
        `\n[truncated - ${files.length - filesIncluded} additional files not shown]\n`,
      );
      return { text: parts.join("\n"), truncated: true, filesIncluded };
    }
    parts.push(entry);
    totalLength += entry.length;
    filesIncluded++;
  }

  return { text: parts.join("\n"), truncated: false, filesIncluded };
}

/**
 * Build the default/fallback AIReviewResult when the API call fails.
 */
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
            rule: { type: "string", description: "The rule text." },
            status: {
              type: "string",
              enum: ["complete", "partial", "missing"],
              description: "Implementation status.",
            },
            confidence: {
              type: "number",
              description: "Confidence score from 0 to 1.",
            },
            details: {
              type: "string",
              description: "Optional details about the implementation.",
            },
          },
          required: ["rule", "status", "confidence"],
        },
      },
      codeQualityScore: {
        type: "number",
        description: "Code quality score from 0 to 15.",
      },
      bugs: {
        type: "array",
        description: "List of identified bugs.",
        items: {
          type: "object",
          properties: {
            file: { type: "string", description: "File path." },
            line: { type: "number", description: "Optional line number." },
            description: { type: "string", description: "Bug description." },
            severity: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Bug severity.",
            },
          },
          required: ["file", "description", "severity"],
        },
      },
      bonusFeatures: {
        type: "array",
        description: "List of bonus/creative features detected beyond base rules.",
        items: { type: "string" },
      },
      uxScore: {
        type: "number",
        description: "UX/design score from 0 to 10.",
      },
      recommendations: {
        type: "array",
        description: "3-5 actionable recommendations.",
        items: { type: "string" },
      },
    },
    required: [
      "rulesImplemented",
      "codeQualityScore",
      "bugs",
      "bonusFeatures",
      "uxScore",
      "recommendations",
    ],
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
        description: "Compliance result for each feature.",
        items: {
          type: "object",
          properties: {
            featureId: { type: "string", description: "The feature ID." },
            featureTitle: { type: "string", description: "The feature title." },
            status: {
              type: "string",
              enum: ["implemented", "partial", "missing"],
              description: "Implementation status.",
            },
            confidence: {
              type: "number",
              description: "Confidence score from 0 to 1.",
            },
            details: {
              type: "string",
              description: "Optional details about the implementation.",
            },
          },
          required: ["featureId", "featureTitle", "status", "confidence"],
        },
      },
    },
    required: ["results"],
  },
};

// ---------------------------------------------------------------------------
// Pass 1: Structural summary (fast, uses Sonnet 4.5)
// ---------------------------------------------------------------------------

/**
 * Quick structural scan of the codebase. Produces a text summary of:
 * - File tree and architecture
 * - Key components / pages / API routes identified
 * - Libraries and patterns used
 * - Which game rules appear to be addressed (surface-level)
 *
 * This summary is then fed into Pass 2 for deep review.
 */
async function structuralSummary(
  sourceFiles: { path: string; content: string }[],
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
): Promise<string> {
  const fileTree = sourceFiles.map((f) => f.path).join("\n");
  const sorted = sortByPriority(sourceFiles);
  const { text: sourceCode } = buildSourceText(sorted, MAX_SUMMARY_SOURCE_CHARS);

  const depsText = packageJson
    ? JSON.stringify(
        { dependencies: packageJson.dependencies, devDependencies: packageJson.devDependencies },
        null,
        2,
      )
    : "No package.json available.";

  const prompt = `You are analyzing a hackathon project (a multiplayer social deduction game called "Among Us for Coders").
Produce a concise structural summary of this codebase.

## File Tree
${fileTree}

## Package Dependencies
${depsText}

## Source Code (key files)
${sourceCode}

## Output Format

Respond with a structured summary covering:
1. **Architecture**: Framework, routing approach, state management, real-time strategy
2. **Key Components**: Main pages/components and what they do
3. **API / Backend**: API routes, database, WebSocket/real-time setup
4. **Game Logic**: Where game rules are implemented (lobby, roles, voting, win conditions, etc.)
5. **Libraries**: Notable libraries used and their purpose
6. **Code Patterns**: TypeScript usage, error handling patterns, testing
7. **UI/UX**: Design system, animations, responsiveness, accessibility hints
8. **Potential Issues**: Obvious bugs, missing error handling, security concerns

Be factual and specific. Reference file paths. Keep it under 2000 words.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    return textBlock?.text ?? "";
  } catch (error) {
    console.error("[ai-reviewer] Structural summary failed:", error);
    // Fall back to just the file tree
    return `File tree:\n${fileTree}`;
  }
}

// ---------------------------------------------------------------------------
// Pass 2: Deep review (Opus 4.6 + extended thinking)
// ---------------------------------------------------------------------------

/**
 * Use Claude Opus 4.6 with extended thinking to perform a comprehensive code
 * review. Takes the structural summary from Pass 1 + the most relevant source
 * files for deep analysis.
 */
export async function reviewCode(
  sourceFiles: { path: string; content: string }[],
  packageJson: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null,
  bonusFeatures: HackathonFeature[],
): Promise<AIReviewResult> {
  try {
    // Pass 1: Get structural summary via Sonnet (fast)
    const summary = await structuralSummary(sourceFiles, packageJson);

    // Pass 2: Deep review via Opus with extended thinking
    const sorted = sortByPriority(sourceFiles);
    const { text: sourceCode, truncated } = buildSourceText(
      sorted,
      MAX_CHUNK_CHARS,
    );

    const announcedFeatures = bonusFeatures.filter(
      (f) => f.status === "announced",
    );

    const rulesChecklist = GAME_RULES_CHECKLIST.map(
      (item, i) => `${i + 1}. [${item.id}] ${item.rule}`,
    ).join("\n");

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

    const prompt = `You are a senior code reviewer evaluating a hackathon team's submission for "Among Us for Coders" — a multiplayer social deduction game where players collaborate to fix broken TypeScript code while trying to identify an impostor.

## Game Rules (Full Reference)

${GAME_RULES}

## Rules Checklist (15 items to evaluate)

${rulesChecklist}

## Bonus Features to Check

${bonusFeaturesText}

## Structural Summary (from initial scan)

${summary}

## Package Dependencies

${depsText}

## Source Code${truncated ? " (most relevant files — some files truncated)" : ""}

${sourceCode}

## Your Task

Think deeply about this codebase. Then call the \`code_review\` tool with your structured review:

1. **rulesImplemented**: For EACH of the 15 game rules in the checklist, evaluate whether it is implemented:
   - "complete": The rule is fully implemented and functional
   - "partial": Some aspects of the rule are implemented but not all
   - "missing": No evidence of this rule being implemented
   - Provide a confidence score from 0.0 to 1.0
   - Add details explaining your assessment

2. **codeQualityScore**: Rate from 0 to 15 based on:
   - TypeScript usage (proper types, no excessive \`any\`, generics where appropriate)
   - Error handling (try/catch, validation, edge cases)
   - Code structure (modularity, separation of concerns, file organization)
   - Naming conventions (clear, consistent, descriptive)
   - Tests presence and quality
   - Overall engineering quality

3. **bugs**: Identify bugs with file path, optional line number, description, and severity:
   - "low": Minor issues, style problems, potential improvements
   - "medium": Logic errors, missing edge cases, potential runtime issues
   - "high": Critical bugs, security issues, data loss risks

4. **bonusFeatures**: List any creative features you detect beyond the 15 base game rules

5. **uxScore**: Rate from 0 to 10 based on:
   - UI quality and visual design
   - Responsiveness and mobile support
   - Animations and transitions
   - Accessibility
   - Overall user experience polish

6. **recommendations**: Provide 3-5 actionable, specific recommendations for improvement.

Be thorough but fair. Give credit where code shows clear intent even if implementation is incomplete.`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      thinking: {
        type: "enabled",
        budget_tokens: 10000,
      },
      tools: [CODE_REVIEW_TOOL],
      tool_choice: { type: "tool", name: "code_review" },
      messages: [{ role: "user", content: prompt }],
    });

    // Extract the tool use response
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUseBlock) {
      console.error("[ai-reviewer] No tool_use block in response");
      return defaultReviewResult();
    }

    const result = toolUseBlock.input as AIReviewResult;

    // Validate and clamp scores
    return {
      rulesImplemented: result.rulesImplemented ?? [],
      codeQualityScore: Math.min(15, Math.max(0, result.codeQualityScore ?? 0)),
      bugs: result.bugs ?? [],
      bonusFeatures: result.bonusFeatures ?? [],
      uxScore: Math.min(10, Math.max(0, result.uxScore ?? 0)),
      recommendations: result.recommendations ?? [],
    };
  } catch (error) {
    console.error("[ai-reviewer] Review failed:", error);
    return defaultReviewResult();
  }
}

// ---------------------------------------------------------------------------
// Feature compliance check (separate lighter call)
// ---------------------------------------------------------------------------

/**
 * Use Claude Sonnet 4.5 to check which bonus features are implemented in the
 * team's codebase. This is a lighter/faster call than the full review.
 */
export async function checkFeatureCompliance(
  sourceFiles: { path: string; content: string }[],
  features: HackathonFeature[],
): Promise<FeatureComplianceResult[]> {
  if (features.length === 0) {
    return [];
  }

  try {
    const sorted = sortByPriority(sourceFiles);
    const { text: sourceCode } = buildSourceText(sorted, MAX_CHUNK_CHARS);

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

## Your Task

For each feature listed above, determine its implementation status by calling the \`feature_compliance\` tool:

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

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUseBlock) {
      console.error("[ai-reviewer] No tool_use block in feature compliance response");
      return features.map((f) => ({
        featureId: f.id,
        featureTitle: f.title,
        status: "missing" as const,
        confidence: 0,
      }));
    }

    const parsed = toolUseBlock.input as { results: FeatureComplianceResult[] };
    return parsed.results ?? [];
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
