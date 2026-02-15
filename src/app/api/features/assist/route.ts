import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { features } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { GAME_RULES } from "@/lib/game-rules";

// ─── POST /api/features/assist ──────────────────────────────────────────────
// Generate a full feature from a single sentence prompt. Uses game rules and
// existing features as context so the AI produces relevant, non-duplicate features.

const anthropic = new Anthropic();

const TOOL_DEFINITION: Anthropic.Tool = {
  name: "feature_suggestion",
  description:
    "Structured output for a complete hackathon feature with title, description, criteria, points, and difficulty.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestedTitle: {
        type: "string",
        description:
          "A short, catchy, and clear title for the feature (5-10 words max)",
      },
      polishedDescription: {
        type: "string",
        description:
          "A polished, clear, engaging description (2-4 sentences) suitable for a Slack announcement to the teams. Should explain what they need to build and why it's fun/interesting.",
      },
      criteria: {
        type: "array",
        items: { type: "string" },
        description:
          "3-5 concrete, testable evaluation criteria that judges can verify in the code. Each should be specific and actionable.",
      },
      suggestedPoints: {
        type: "number",
        description:
          "Point value between 5 and 25. 5-8 for easy, 10-15 for medium, 18-25 for hard.",
      },
      suggestedDifficulty: {
        type: "string",
        enum: ["easy", "medium", "hard"],
        description:
          "Difficulty based on implementation effort for a team using AI-assisted coding (Cursor)",
      },
    },
    required: [
      "suggestedTitle",
      "polishedDescription",
      "criteria",
      "suggestedPoints",
      "suggestedDifficulty",
    ],
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { prompt, title, description } = body as {
      prompt?: string;
      title?: string;
      description?: string;
    };

    // Accept either a single "prompt" or the old title+description format
    const userInput =
      prompt?.trim() ||
      [title?.trim(), description?.trim()].filter(Boolean).join(" — ");

    if (!userInput) {
      return NextResponse.json(
        {
          error:
            "Provide a 'prompt' (single sentence) or 'title' + 'description'",
        },
        { status: 400 },
      );
    }

    // Fetch existing features for context (avoid duplicates)
    const existingFeatures = await db
      .select({
        title: features.title,
        description: features.description,
        status: features.status,
        points: features.points,
        difficulty: features.difficulty,
      })
      .from(features)
      .orderBy(desc(features.createdAt));

    const existingFeaturesText =
      existingFeatures.length > 0
        ? existingFeatures
            .map(
              (f) =>
                `- [${f.status}] ${f.title} (${f.difficulty}, ${f.points}pts): ${f.description}`,
            )
            .join("\n")
        : "No features created yet.";

    const systemPrompt = `You are an expert game designer and hackathon organizer. You help create bonus feature challenges for a 2-day hackathon called "AI For Coders".

## Context

Teams are building "Among Us for Coders" — a web-based multiplayer social deduction game. They use Cursor (AI-assisted IDE) to develop with Next.js/TypeScript. The teams include developers, PMs, designers, and DevOps engineers.

## Full Game Rules

${GAME_RULES}

## Already Created Features

${existingFeaturesText}

## Your Job

Given a simple prompt from the admin (could be just a single sentence or even a few words), create a COMPLETE feature challenge:

1. **suggestedTitle**: Short, catchy title (5-10 words). Should sound exciting and fun.
2. **polishedDescription**: 2-4 sentences explaining what to build. Be specific about the expected behavior. Make it engaging for a Slack announcement.
3. **criteria**: 3-5 concrete, testable criteria. Each should be verifiable by looking at the code or testing the app. Avoid vague criteria like "well implemented". Be specific: "Users can see X", "System does Y when Z happens".
4. **suggestedPoints**: 5-25 based on complexity. Remember teams use AI-assisted coding, so pure coding tasks are easier than design/UX tasks.
5. **suggestedDifficulty**: Easy (30min-1h), Medium (1-2h), Hard (2-4h) for a team with AI assistance.

## Important Guidelines

- Features should be FUN and engaging, not just technical checklists
- Features should be achievable within the hackathon timeframe
- Don't duplicate existing features
- Consider that some teams may be non-technical (PMs/designers) — features that reward creativity and design are welcome
- Features should complement the base game rules, not contradict them
- Include features that test different skills: UI/UX, real-time systems, game design, accessibility, performance, etc.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1500,
      system: systemPrompt,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "tool", name: "feature_suggestion" },
      messages: [
        {
          role: "user",
          content: `Create a feature based on this idea: "${userInput}"`,
        },
      ],
    });

    const toolUseBlock = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUseBlock) {
      return NextResponse.json(
        { error: "AI did not return structured output" },
        { status: 500 },
      );
    }

    const result = toolUseBlock.input as {
      suggestedTitle: string;
      polishedDescription: string;
      criteria: string[];
      suggestedPoints: number;
      suggestedDifficulty: "easy" | "medium" | "hard";
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/features/assist error:", error);
    return NextResponse.json(
      { error: "Failed to generate feature suggestions" },
      { status: 500 },
    );
  }
}
