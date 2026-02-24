import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { analyses, teams } from "@/lib/db/schema";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const statusParam = searchParams.get("status");

    let limit = DEFAULT_LIMIT;
    if (limitParam !== null) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) limit = Math.min(parsed, MAX_LIMIT);
    }

    const statuses =
      statusParam !== null && statusParam !== ""
        ? statusParam.split(",").map((s) => s.trim())
        : null;

    const selection = {
      id: analyses.id,
      teamId: analyses.teamId,
      teamName: teams.name,
      triggeredBy: analyses.triggeredBy,
      commitSha: analyses.commitSha,
      status: analyses.status,
      result: analyses.result,
      createdAt: analyses.createdAt,
      startedAt: analyses.startedAt,
      completedAt: analyses.completedAt,
    };

    const rows = statuses?.length
      ? await db
          .select(selection)
          .from(analyses)
          .innerJoin(teams, eq(analyses.teamId, teams.id))
          .where(inArray(analyses.status, statuses))
          .orderBy(desc(analyses.createdAt))
          .limit(limit)
      : await db
          .select(selection)
          .from(analyses)
          .innerJoin(teams, eq(analyses.teamId, teams.id))
          .orderBy(desc(analyses.createdAt))
          .limit(limit);

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        teamId: r.teamId,
        teamName: r.teamName,
        triggeredBy: r.triggeredBy,
        commitSha: r.commitSha,
        status: r.status,
        result: r.result,
        createdAt: r.createdAt?.toISOString() ?? null,
        startedAt: r.startedAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    console.error("[api/analyses]", err);
    return NextResponse.json(
      { error: "Failed to fetch analyses" },
      { status: 500 },
    );
  }
}
