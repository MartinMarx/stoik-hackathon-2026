import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, analyses } from "@/lib/db/schema";
import { runAnalysis } from "@/lib/analysis/pipeline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

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
    // Buffers of different lengths throw — treat as mismatch
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/github
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Read raw body & verify HMAC signature
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Only process push events
  const event = request.headers.get("x-github-event");
  if (event !== "push") {
    return NextResponse.json({ ignored: true, reason: `event: ${event}` });
  }

  // 3. Parse payload
  const payload = JSON.parse(rawBody) as {
    repository: { full_name: string };
    after: string;
  };

  const [repoOwner, repoName] = payload.repository.full_name.split("/");
  const commitSha = payload.after;

  // 4. Find the matching team
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.repoOwner, repoOwner), eq(teams.repoName, repoName)));

  if (!team) {
    return NextResponse.json(
      { error: "No team found for this repository" },
      { status: 404 },
    );
  }

  // 5. Debounce: check for running/pending analysis in the last 2 minutes
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

  let debounced = false;

  if (existingAnalysis) {
    // Update the existing analysis with the latest commit SHA
    await db
      .update(analyses)
      .set({ commitSha })
      .where(eq(analyses.id, existingAnalysis.id));
    debounced = true;
  } else {
    // Fire-and-forget: trigger a new analysis in the background
    runAnalysis(team.id, commitSha, "webhook").catch(console.error);
  }

  // 6. Respond immediately
  return NextResponse.json({
    team: team.name,
    debounced,
  });
}
