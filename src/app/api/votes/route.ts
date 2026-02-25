import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, scores, votes, votePhase } from "@/lib/db/schema";
import { globalEmitter } from "@/lib/events/emitter";
import type { VotesResponse } from "@/types";

export async function buildVotesResponse(): Promise<VotesResponse> {
  const allTeams = await db.select().from(teams);
  const allVotes = await db.select().from(votes);
  const [phase] = await db
    .select()
    .from(votePhase)
    .where(eq(votePhase.id, 1))
    .limit(1);

  const voteCountByTeam = new Map<string, number>();
  const voterTeamIds = new Set<string>();
  for (const v of allVotes) {
    voteCountByTeam.set(
      v.votedForTeamId,
      (voteCountByTeam.get(v.votedForTeamId) ?? 0) + 1,
    );
    voterTeamIds.add(v.voterTeamId);
  }

  const teamsWithScores = await Promise.all(
    allTeams.map(async (team) => {
      const [latest] = await db
        .select()
        .from(scores)
        .where(eq(scores.teamId, team.id))
        .orderBy(desc(scores.recordedAt))
        .limit(1);
      return {
        teamId: team.id,
        name: team.name,
        memberNames: team.memberNames ?? [],
        autoScore: latest?.total ?? 0,
        voteCount: voteCountByTeam.get(team.id) ?? 0,
        hasVoted: voterTeamIds.has(team.id),
      };
    }),
  );

  const totalTeams = allTeams.length;
  const votedCount = teamsWithScores.reduce(
    (sum, t) => sum + (t.hasVoted ? t.memberNames?.length || 1 : 0),
    0,
  );
  const allVoted = totalTeams > 0 && votedCount >= totalTeams;
  const voteEnded = !!phase?.endedAt;

  let voteWinnerTeamId: string | undefined;
  if (voteEnded && teamsWithScores.length > 0) {
    const sorted = [...teamsWithScores].sort(
      (a, b) => b.voteCount - a.voteCount || b.autoScore - a.autoScore,
    );
    if (sorted[0].voteCount > 0) {
      voteWinnerTeamId = sorted[0].teamId;
    }
  }

  return {
    teams: teamsWithScores,
    totalTeams,
    votedCount,
    allVoted,
    voteEnded,
    voteWinnerTeamId,
  };
}

export async function GET() {
  try {
    const response = await buildVotesResponse();
    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/votes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch votes" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const voterTeamId = body.voterTeamId as string | undefined;
    const votedForTeamId = body.votedForTeamId as string | undefined;

    if (
      !voterTeamId ||
      !votedForTeamId ||
      typeof voterTeamId !== "string" ||
      typeof votedForTeamId !== "string"
    ) {
      return NextResponse.json(
        { error: "voterTeamId and votedForTeamId required" },
        { status: 400 },
      );
    }

    if (voterTeamId === votedForTeamId) {
      return NextResponse.json(
        { error: "Cannot vote for your own team" },
        { status: 400 },
      );
    }

    const [voterTeam, votedForTeam] = await Promise.all([
      db.select().from(teams).where(eq(teams.id, voterTeamId)).limit(1),
      db.select().from(teams).where(eq(teams.id, votedForTeamId)).limit(1),
    ]);

    if (!voterTeam.length || !votedForTeam.length) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    await db.delete(votes).where(eq(votes.voterTeamId, voterTeamId));

    await db.insert(votes).values({
      voterTeamId,
      votedForTeamId,
    });

    const payload = await buildVotesResponse();
    globalEmitter.emit("vote", payload);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("POST /api/votes error:", error);
    return NextResponse.json(
      { error: "Failed to submit vote" },
      { status: 500 },
    );
  }
}
