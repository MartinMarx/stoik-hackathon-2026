import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadPrompt } from "@/lib/llm/load";
import { config, tool } from "@/lib/llm/achievement-enhance/config";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    if (!name && !description) {
      return NextResponse.json(
        { error: "Provide at least a name or description" },
        { status: 400 },
      );
    }

    const systemPrompt = loadPrompt("achievement-enhance", {});

    const userInput = [
      name && `Name: "${name}"`,
      description && `Description: "${description}"`,
    ]
      .filter(Boolean)
      .join("\n");

    const message = await anthropic.messages.create({
      ...config,
      system: systemPrompt,
      tools: [tool],
      messages: [
        {
          role: "user",
          content: `Enhance this achievement:\n${userInput}`,
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

    return NextResponse.json(toolUseBlock.input);
  } catch (error) {
    console.error("POST /api/custom-achievements/enhance error:", error);
    return NextResponse.json(
      { error: "Failed to enhance achievement" },
      { status: 500 },
    );
  }
}
