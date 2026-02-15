import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and, count, SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, teams } from "@/lib/db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  teamId: string;
  teamName: string;
  type: "commit" | "achievement" | "feature_completed" | "analysis" | "score_change";
  data: Record<string, unknown>;
  points: number | null;
  createdAt: string;
}

// ─── GET /api/events ────────────────────────────────────────────────────────
// List events/timeline with optional filtering by team and type.
// Query params: ?team=xxx&limit=50&offset=0&type=achievement

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const teamId = searchParams.get("team");
    const type = searchParams.get("type");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    // Parse and clamp limit (default 50, max 100)
    let limit = 50;
    if (limitParam !== null) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100);
      }
    }

    // Parse offset (default 0)
    let offset = 0;
    if (offsetParam !== null) {
      const parsed = parseInt(offsetParam, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        offset = parsed;
      }
    }

    // Build filter conditions
    const conditions: SQL[] = [];

    if (teamId) {
      conditions.push(eq(events.teamId, teamId));
    }

    if (type) {
      conditions.push(eq(events.type, type));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Step 1: Query total count (without limit/offset) for pagination
    const [totalResult] = await db
      .select({ count: count() })
      .from(events)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    // Step 2: Query events with filters, ordering, limit, and offset
    const rows = await db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(desc(events.createdAt))
      .limit(limit)
      .offset(offset);

    // Step 3: Get unique teamIds and fetch team names
    const uniqueTeamIds = [...new Set(rows.map((row) => row.teamId))];

    const teamNameMap = new Map<string, string>();

    if (uniqueTeamIds.length > 0) {
      const teamRows = await Promise.all(
        uniqueTeamIds.map((id) =>
          db
            .select({ id: teams.id, name: teams.name })
            .from(teams)
            .where(eq(teams.id, id))
            .limit(1),
        ),
      );

      for (const [team] of teamRows) {
        if (team) {
          teamNameMap.set(team.id, team.name);
        }
      }
    }

    // Step 4: Map to TimelineEvent with teamName
    const timelineEvents: TimelineEvent[] = rows.map((row) => ({
      id: row.id,
      teamId: row.teamId,
      teamName: teamNameMap.get(row.teamId) ?? "Unknown",
      type: row.type as TimelineEvent["type"],
      data: (row.data ?? {}) as Record<string, unknown>,
      points: row.points,
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ events: timelineEvents, total });
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 },
    );
  }
}
