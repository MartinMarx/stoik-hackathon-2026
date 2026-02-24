import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, analyses, features } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { fetchBranches } from "@/lib/github/client";
import { getUnlockedAchievementsForTeam } from "@/lib/achievements/resolve";
import { getTotalScore } from "@/lib/scoring/engine";
import type { ScoreBreakdown } from "@/types";

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
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Get latest commit SHA from GitHub
    const commitSha = await getLatestCommitSha(team.repoOwner, team.repoName);

    if (!commitSha) {
      return NextResponse.json(
        {
          error: `Could not resolve commit SHA for ${team.repoOwner}/${team.repoName}`,
        },
        { status: 502 },
      );
    }

    // Schedule analysis after response (survives on Vercel)
    after(async () => {
      console.log(
        `[analyze] Starting analysis for team "${team.name}" (${commitSha})`,
      );
      try {
        await runAnalysis(team.id, commitSha, "manual");
        console.log(`[analyze] Analysis completed for team "${team.name}"`);
      } catch (err) {
        console.error(
          `[analyze] Analysis failed for team "${team.name}":`,
          err,
        );
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
      .where(and(eq(analyses.teamId, teamId), eq(analyses.status, "completed")))
      .orderBy(desc(analyses.completedAt))
      .limit(1);

    if (!latest) {
      return NextResponse.json(
        { error: "No analysis found for this team" },
        { status: 404 },
      );
    }

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    const result = latest.result as Record<string, unknown> | null;
    const teamMeta = {
      repoUrl: team?.repoUrl ?? null,
      slackChannelId: team?.slackChannelId ?? null,
      appUrl: team?.appUrl ?? null,
      memberNames: team?.memberNames ?? [],
    };

    let resultPayload = result;
    if (result && typeof result === "object") {
      resultPayload = {
        ...result,
        achievements: await getUnlockedAchievementsForTeam(teamId),
      };

      const announced = await db
        .select({
          id: features.id,
          title: features.title,
          description: features.description,
          criteria: features.criteria,
          points: features.points,
        })
        .from(features)
        .where(eq(features.status, "announced"));

      const existingCompliance = (result.featuresCompliance ?? []) as Array<{
        featureId: string;
        featureTitle: string;
        featureDescription?: string;
        status: string;
        confidence: number;
        details?: string;
        criteria?: string[];
      }>;
      const byFeatureId = new Map(
        existingCompliance.map((c) => [c.featureId, c]),
      );

      const featuresCompliance = announced.map((f) => {
        const existing = byFeatureId.get(f.id);
        const criteria = existing?.criteria?.length
          ? existing.criteria
          : f.criteria;
        const featureDescription =
          existing?.featureDescription ?? f.description;
        if (existing) {
          return {
            ...existing,
            criteria,
            featureDescription,
            points: f.points,
          };
        }
        return {
          featureId: f.id,
          featureTitle: f.title,
          featureDescription: f.description,
          status: "missing" as const,
          confidence: 0,
          criteria: f.criteria,
          points: f.points,
        };
      });

      resultPayload = {
        ...resultPayload,
        featuresCompliance,
      };
    }

    const payload =
      resultPayload && typeof resultPayload === "object"
        ? { ...latest, ...teamMeta, result: resultPayload }
        : { ...latest, ...teamMeta };
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[analyze] GET /api/analyze/[teamId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analysis" },
      { status: 500 },
    );
  }
}
