import crypto from "crypto";
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { getConfigBool, CONFIG_KEYS } from "@/lib/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // No secret configured — skip verification (dev convenience)
  if (!secret) return true;

  if (!signature) return false;

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/github
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    console.log("[webhook] Received GitHub webhook");

    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    if (!verifySignature(rawBody, signature)) {
      console.warn("[webhook] Signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (await getConfigBool(CONFIG_KEYS.GITHUB_WEBHOOKS_PAUSED)) {
      console.log("[webhook] GitHub webhooks are paused");
      return NextResponse.json({ paused: true });
    }

    const event = request.headers.get("x-github-event");
    if (event !== "push") {
      console.log(`[webhook] Ignoring event: ${event}`);
      return NextResponse.json({ ignored: true, reason: `event: ${event}` });
    }

    const payload = JSON.parse(rawBody) as {
      repository: { full_name: string };
      after: string;
    };

    const [repoOwner, repoName] = payload.repository.full_name.split("/");
    const commitSha = payload.after;
    console.log(`[webhook] Push to ${repoOwner}/${repoName} @ ${commitSha}`);

    const [team] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.repoOwner, repoOwner), eq(teams.repoName, repoName)));

    if (!team) {
      console.warn(`[webhook] No team found for ${repoOwner}/${repoName}`);
      return NextResponse.json(
        { error: "No team found for this repository" },
        { status: 404 },
      );
    }

    after(async () => {
      console.log(
        `[webhook] Starting analysis for team "${team.name}" (${commitSha})`,
      );
      try {
        await runAnalysis(team.id, commitSha, "webhook");
        console.log(`[webhook] Analysis completed for team "${team.name}"`);
      } catch (err) {
        console.error(
          `[webhook] Analysis failed for team "${team.name}":`,
          err,
        );
      }
    });

    return NextResponse.json({ ok: true, team: team.name });
  } catch (error) {
    console.error("[webhook] POST /api/webhooks/github error:", error);
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
