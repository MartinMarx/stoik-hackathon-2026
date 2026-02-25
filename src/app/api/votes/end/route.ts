import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { votes, achievements, scores, votePhase } from "@/lib/db/schema";
import { globalEmitter } from "@/lib/events/emitter";
import { verifyToken } from "@/app/api/auth/route";
import { buildVotesResponse } from "../route";
import { getTotalScore } from "@/lib/scoring/engine";
import {
  getAchievementPoints,
  getAchievementById,
} from "@/lib/achievements/definitions";
import type { ScoreBreakdown } from "@/types";

const COOKIE_NAME = "admin_session";
const CROWD_PLEASER_ID = "crowd-pleaser";

function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD env var is not set");
  return pw;
}

async function grantCrowdPleaser() {
  const allVotes = await db.select().from(votes);
  if (allVotes.length === 0) return;

  const countByTeam = new Map<string, number>();
  for (const v of allVotes) {
    countByTeam.set(
      v.votedForTeamId,
      (countByTeam.get(v.votedForTeamId) ?? 0) + 1,
    );
  }

  let winnerTeamId = "";
  let maxVotes = 0;
  let winnerScore = -1;

  for (const [teamId, count] of countByTeam) {
    if (count > maxVotes) {
      maxVotes = count;
      winnerTeamId = teamId;
      winnerScore = -1;
    } else if (count === maxVotes) {
      const [a] = await db
        .select()
        .from(scores)
        .where(eq(scores.teamId, teamId))
        .orderBy(desc(scores.recordedAt))
        .limit(1);
      const [b] =
        winnerScore >= 0
          ? [{ total: winnerScore }]
          : await db
              .select()
              .from(scores)
              .where(eq(scores.teamId, winnerTeamId))
              .orderBy(desc(scores.recordedAt))
              .limit(1);
      winnerScore = b?.total ?? 0;
      if ((a?.total ?? 0) > winnerScore) {
        winnerTeamId = teamId;
        winnerScore = a?.total ?? 0;
      }
    }
  }

  if (!winnerTeamId) return;

  const existing = await db
    .select()
    .from(achievements)
    .where(eq(achievements.teamId, winnerTeamId));
  if (existing.some((a) => a.achievementId === CROWD_PLEASER_ID)) return;

  await db.insert(achievements).values({
    teamId: winnerTeamId,
    achievementId: CROWD_PLEASER_ID,
  });

  const def = getAchievementById(CROWD_PLEASER_ID);
  if (!def) return;
  const bonusPoints = getAchievementPoints(def);

  const [latestScore] = await db
    .select()
    .from(scores)
    .where(eq(scores.teamId, winnerTeamId))
    .orderBy(desc(scores.recordedAt))
    .limit(1);

  if (!latestScore) return;

  const breakdown = latestScore.breakdown as ScoreBreakdown;
  const prevBonus = breakdown.achievementBonus ?? { total: 0, count: 0 };
  breakdown.achievementBonus = {
    total: prevBonus.total + bonusPoints,
    count: prevBonus.count + 1,
  };
  const newTotal = getTotalScore(breakdown);

  await db
    .update(scores)
    .set({ breakdown, total: newTotal })
    .where(eq(scores.id, latestScore.id));
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const password = getAdminPassword();
    if (!token || !verifyToken(token, password)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const existing = await db
      .select()
      .from(votePhase)
      .where(eq(votePhase.id, 1))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(votePhase)
        .set({ endedAt: now })
        .where(eq(votePhase.id, 1));
    } else {
      await db.insert(votePhase).values({ id: 1, endedAt: now });
    }

    await grantCrowdPleaser();

    const payload = await buildVotesResponse();
    globalEmitter.emit("vote", payload);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("POST /api/votes/end error:", error);
    return NextResponse.json({ error: "Failed to end vote" }, { status: 500 });
  }
}
