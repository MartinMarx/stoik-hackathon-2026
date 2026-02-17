import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { fetchBranches } from "@/lib/github/client";

// ---------------------------------------------------------------------------
// Helper: resolve the latest commit SHA from the main/master branch
// ---------------------------------------------------------------------------

async function getLatestCommitSha(
  owner: string,
  repo: string,
): Promise<string | null> {
  const branches = await fetchBranches(owner, repo);
  const main = branches.find((b) => b.name === "main" || b.name === "master");
  return main?.sha ?? null;
}

// ---------------------------------------------------------------------------
// POST /api/analyze/[teamId] — trigger analysis for ONE team
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;

    // Look up the team
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 },
      );
    }

    // Get latest commit SHA from GitHub
    const commitSha = await getLatestCommitSha(team.repoOwner, team.repoName);

    if (!commitSha) {
      return NextResponse.json(
        { error: `Could not resolve commit SHA for ${team.repoOwner}/${team.repoName}` },
        { status: 502 },
      );
    }

    // Schedule analysis after response (survives on Vercel)
    after(async () => {
      console.log(`[analyze] Starting analysis for team "${team.name}" (${commitSha})`);
      try {
        await runAnalysis(team.id, commitSha, "manual");
        console.log(`[analyze] Analysis completed for team "${team.name}"`);
      } catch (err) {
        console.error(`[analyze] Analysis failed for team "${team.name}":`, err);
      }
    });

    return NextResponse.json({ ok: true, team: team.name });
  } catch (error) {
    console.error("[analyze] POST /api/analyze/[teamId] error:", error);
    return NextResponse.json(
      { error: "Failed to trigger analysis" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/analyze/[teamId] — get latest analysis result for a specific team
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;

    const [latest] = await db
      .select()
      .from(analyses)
      .where(eq(analyses.teamId, teamId))
      .orderBy(desc(analyses.completedAt))
      .limit(1);

    if (!latest) {
      return NextResponse.json(
        { error: "No analysis found for this team" },
        { status: 404 },
      );
    }

    return NextResponse.json(latest);
  } catch (error) {
    console.error("[analyze] GET /api/analyze/[teamId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 },
    );
  }
}
