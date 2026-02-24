import { NextRequest, NextResponse } from "next/server";
import { getConfigBool, setConfigBool, CONFIG_KEYS } from "@/lib/config";

export async function GET() {
  try {
    const [mcpPaused, githubWebhooksPaused] = await Promise.all([
      getConfigBool(CONFIG_KEYS.MCP_PAUSED),
      getConfigBool(CONFIG_KEYS.GITHUB_WEBHOOKS_PAUSED),
    ]);
    return NextResponse.json({ mcpPaused, githubWebhooksPaused });
  } catch (err) {
    console.error("GET /api/settings/pause error:", err);
    return NextResponse.json(
      { error: "Failed to fetch pause state" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mcpPaused = body.mcpPaused as boolean | undefined;
    const githubWebhooksPaused = body.githubWebhooksPaused as
      | boolean
      | undefined;

    if (typeof mcpPaused === "boolean") {
      await setConfigBool(CONFIG_KEYS.MCP_PAUSED, mcpPaused);
    }
    if (typeof githubWebhooksPaused === "boolean") {
      await setConfigBool(
        CONFIG_KEYS.GITHUB_WEBHOOKS_PAUSED,
        githubWebhooksPaused,
      );
    }

    const [mcp, webhooks] = await Promise.all([
      getConfigBool(CONFIG_KEYS.MCP_PAUSED),
      getConfigBool(CONFIG_KEYS.GITHUB_WEBHOOKS_PAUSED),
    ]);
    return NextResponse.json({
      mcpPaused: mcp,
      githubWebhooksPaused: webhooks,
    });
  } catch (err) {
    console.error("POST /api/settings/pause error:", err);
    return NextResponse.json(
      { error: "Failed to update pause state" },
      { status: 500 },
    );
  }
}
