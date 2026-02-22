import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { features } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { GAME_RULES } from "@/lib/game-rules";
import { loadPrompt } from "@/lib/llm/load";
import { config, tool } from "@/lib/llm/features-assist/config";

const anthropic = new Anthropic();

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

    const systemPrompt = loadPrompt("features-assist", {
      GAME_RULES: GAME_RULES,
      EXISTING_FEATURES: existingFeaturesText,
    });

    const message = await anthropic.messages.create({
      ...config,
      system: systemPrompt,
      tools: [tool],
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
