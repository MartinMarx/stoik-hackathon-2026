import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// ─── POST /api/features/assist ──────────────────────────────────────────────
// Use Claude AI to generate criteria, suggested points, difficulty, and polished description.

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are an assistant for a hackathon admin panel. The hackathon is called "Among Us for Coders" — teams are building a web-based multiplayer game inspired by Among Us, but themed around software development and coding.

In the game, players are "developers" on a spaceship/office, and some are secretly "impostors" trying to sabotage the codebase. Crewmates must complete coding tasks (mini-games) while identifying the impostors through discussion and voting.

Your job is to help the admin define feature challenges for the hackathon teams. Given a feature title and rough description, you must:
1. Write 3-5 concrete, testable evaluation criteria that judges can use to verify the feature is implemented correctly
2. Suggest a point value (5-25 range) based on the implementation complexity
3. Suggest a difficulty level (easy, medium, or hard) based on estimated implementation effort
4. Polish the description so it's clear, engaging, and suitable for a Slack announcement to the teams`;

const TOOL_DEFINITION: Anthropic.Tool = {
  name: "feature_suggestion",
  description: "Structured output for a hackathon feature suggestion with criteria, points, difficulty, and polished description.",
  input_schema: {
    type: "object" as const,
    properties: {
      criteria: {
        type: "array",
        items: { type: "string" },
        description: "3-5 concrete, testable evaluation criteria for judging this feature",
      },
      suggestedPoints: {
        type: "number",
        description: "Suggested point value between 5 and 25 based on complexity",
      },
      suggestedDifficulty: {
        type: "string",
        enum: ["easy", "medium", "hard"],
        description: "Suggested difficulty based on implementation effort",
      },
      polishedDescription: {
        type: "string",
        description: "A polished, clear, and engaging description suitable for Slack announcement",
      },
    },
    required: ["criteria", "suggestedPoints", "suggestedDifficulty", "polishedDescription"],
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { title, description } = body as {
      title?: string;
      description?: string;
    };

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "description is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [TOOL_DEFINITION],
      tool_choice: { type: "tool", name: "feature_suggestion" },
      messages: [
        {
          role: "user",
          content: `Feature title: ${title.trim()}\n\nRough description: ${description.trim()}`,
        },
      ],
    });

    // Extract the tool use result
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
      criteria: string[];
      suggestedPoints: number;
      suggestedDifficulty: "easy" | "medium" | "hard";
      polishedDescription: string;
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
