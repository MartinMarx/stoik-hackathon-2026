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
// POST /api/analyze — trigger analysis for ALL teams
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest) {
  try {
    const allTeams = await db.select().from(teams);

    if (allTeams.length === 0) {
      return NextResponse.json(
        { error: "No teams found" },
        { status: 404 },
      );
    }

    let teamsTriggered = 0;

    for (const team of allTeams) {
      const commitSha = await getLatestCommitSha(team.repoOwner, team.repoName);

      if (!commitSha) {
        console.error(
          `[analyze] Could not resolve commit SHA for ${team.repoOwner}/${team.repoName} — skipping team "${team.name}"`,
        );
        continue;
      }

      teamsTriggered++;

      // Schedule analysis after response (survives on Vercel)
      const t = team; // capture for closure
      const sha = commitSha;
      after(async () => {
        console.log(`[analyze-all] Starting analysis for team "${t.name}" (${sha})`);
        try {
          await runAnalysis(t.id, sha, "manual");
          console.log(`[analyze-all] Analysis completed for team "${t.name}"`);
        } catch (err) {
          console.error(`[analyze-all] Analysis failed for team "${t.name}":`, err);
        }
      });
    }

    return NextResponse.json({ ok: true, teamsTriggered });
  } catch (error) {
    console.error("[analyze] POST /api/analyze error:", error);
    return NextResponse.json(
      { error: "Failed to trigger analyses" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/analyze — return latest analysis for ALL teams (dashboard overview)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const allTeams = await db.select().from(teams);

    const results = await Promise.all(
      allTeams.map(async (team) => {
        const [latest] = await db
          .select()
          .from(analyses)
          .where(eq(analyses.teamId, team.id))
          .orderBy(desc(analyses.completedAt))
          .limit(1);

        return {
          teamId: team.id,
          teamName: team.name,
          status: latest?.status ?? null,
          completedAt: latest?.completedAt?.toISOString() ?? null,
          totalScore: latest?.result
            ? (latest.result as { totalScore?: number }).totalScore ?? null
            : null,
        };
      }),
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("[analyze] GET /api/analyze error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 },
    );
  }
}
