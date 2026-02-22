import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadPrompt } from "@/lib/llm/load";
import { config } from "@/lib/llm/slack-polish/config";

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json(
        { error: "text is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const systemPrompt = loadPrompt("slack-polish", {});

    const message = await anthropic.messages.create({
      ...config,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const polished =
      (textBlock && "text" in textBlock && textBlock.text?.trim()) ?? text;

    return NextResponse.json({ polished });
  } catch (error) {
    console.error("POST /api/slack/polish error:", error);
    return NextResponse.json(
      { error: "Failed to polish message" },
      { status: 500 },
    );
  }
}
