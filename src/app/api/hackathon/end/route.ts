import { after } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { fetchBranches } from "@/lib/github/client";
import { getConfigBool, setConfigBool, CONFIG_KEYS } from "@/lib/config";

async function getLatestCommitSha(owner: string, repo: string) {
  const branches = await fetchBranches(owner, repo);
  const main = branches.find((b) => b.name === "main" || b.name === "master");
  return main?.sha ?? null;
}

export async function GET() {
  try {
    const ended = await getConfigBool(CONFIG_KEYS.HACKATHON_ENDED);
    return NextResponse.json({ ended });
  } catch (error) {
    console.error("GET /api/hackathon/end error:", error);
    return NextResponse.json(
      { error: "Failed to fetch hackathon state" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const allTeams = await db.select().from(teams);

    if (allTeams.length === 0) {
      return NextResponse.json({ error: "No teams found" }, { status: 404 });
    }

    const frozenTeams = await Promise.all(
      allTeams.map(async (team) => {
        const sha = await getLatestCommitSha(team.repoOwner, team.repoName);
        if (sha) {
          await db
            .update(teams)
            .set({ frozenCommitSha: sha })
            .where(eq(teams.id, team.id));
        }
        return { teamId: team.id, teamName: team.name, frozenCommitSha: sha };
      }),
    );

    await setConfigBool(CONFIG_KEYS.HACKATHON_ENDED, true);
    await setConfigBool(CONFIG_KEYS.GITHUB_WEBHOOKS_PAUSED, true);

    const valid = frozenTeams.filter(
      (t): t is typeof t & { frozenCommitSha: string } =>
        t.frozenCommitSha !== null,
    );

    after(async () => {
      for (const { teamId, teamName, frozenCommitSha } of valid) {
        console.log(
          `[hackathon-end] Starting final analysis for team "${teamName}" (${frozenCommitSha})`,
        );
        try {
          await runAnalysis(teamId, frozenCommitSha, "manual");
          console.log(
            `[hackathon-end] Analysis completed for team "${teamName}"`,
          );
        } catch (err) {
          console.error(
            `[hackathon-end] Analysis failed for team "${teamName}":`,
            err,
          );
        }
      }
    });

    return NextResponse.json({
      ok: true,
      ended: true,
      teams: frozenTeams,
    });
  } catch (error) {
    console.error("POST /api/hackathon/end error:", error);
    return NextResponse.json(
      { error: "Failed to end hackathon" },
      { status: 500 },
    );
  }
}
