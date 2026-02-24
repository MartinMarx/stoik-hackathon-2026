import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, analyses } from "@/lib/db/schema";
import {
  runAnalysis,
  cancelRunningAnalysisForTeam,
  AnalysisCancelledError,
} from "@/lib/analysis/pipeline";
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

  // 2. Only process push events
  const event = request.headers.get("x-github-event");
  if (event !== "push") {
    console.log(`[webhook] Ignoring event: ${event}`);
    return NextResponse.json({ ignored: true, reason: `event: ${event}` });
  }

  // 3. Parse payload
  const payload = JSON.parse(rawBody) as {
    repository: { full_name: string };
    after: string;
  };

  const [repoOwner, repoName] = payload.repository.full_name.split("/");
  const commitSha = payload.after;
  console.log(`[webhook] Push to ${repoOwner}/${repoName} @ ${commitSha}`);

  // 4. Find the matching team
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

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const [existingAnalysis] = await db
    .select()
    .from(analyses)
    .where(
      and(
        eq(analyses.teamId, team.id),
        or(eq(analyses.status, "pending"), eq(analyses.status, "running")),
        gte(analyses.createdAt, twoMinutesAgo),
      ),
    );

  if (existingAnalysis) {
    console.log(
      `[webhook] Cancelling previous analysis ${existingAnalysis.id} for team "${team.name}"`,
    );
    cancelRunningAnalysisForTeam(team.id);
  }

  // 6. Run analysis inline (not in after() — more reliable in dev mode)
  console.log(
    `[webhook] Starting analysis for team "${team.name}" (${commitSha})`,
  );
  try {
    await runAnalysis(team.id, commitSha, "webhook");
    console.log(`[webhook] Analysis completed for team "${team.name}"`);
  } catch (err) {
    if (err instanceof AnalysisCancelledError) {
      console.log(
        `[webhook] Previous analysis was cancelled for team "${team.name}" (new run started)`,
      );
      return NextResponse.json({ team: team.name, cancelled: true });
    }
    console.error(`[webhook] Analysis failed for team "${team.name}":`, err);
    return NextResponse.json(
      {
        error: "Analysis failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ team: team.name });
}
