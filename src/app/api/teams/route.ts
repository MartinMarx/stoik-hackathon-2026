import { NextRequest, NextResponse } from "next/server";
import { eq, desc, count, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  teams,
  scores,
  achievements,
  analyses,
  cursorMetrics,
  events,
  featureCompletions,
  votes,
} from "@/lib/db/schema";
import { sendWelcomeMessage } from "@/lib/slack/client";

// ─── GET /api/teams ─────────────────────────────────────────────────────────
// List all teams with their latest score and achievement count, sorted by score desc.

export async function GET() {
  try {
    const allTeams = await db.select().from(teams);

    const teamsWithStats = await Promise.all(
      allTeams.map(async (team) => {
        // Get the most recent score for this team
        const [latestScore] = await db
          .select()
          .from(scores)
          .where(eq(scores.teamId, team.id))
          .orderBy(desc(scores.recordedAt))
          .limit(1);

        // Count achievements for this team
        const [achievementCount] = await db
          .select({ count: count() })
          .from(achievements)
          .where(eq(achievements.teamId, team.id));

        return {
          ...team,
          latestScore: latestScore ?? null,
          achievementCount: achievementCount?.count ?? 0,
        };
      }),
    );

    // Sort by latest score total descending (teams without scores go to the end)
    teamsWithStats.sort((a, b) => {
      const scoreA = a.latestScore?.total ?? -1;
      const scoreB = b.latestScore?.total ?? -1;
      return scoreB - scoreA;
    });

    return NextResponse.json(teamsWithStats);
  } catch (error) {
    console.error("GET /api/teams error:", error);
    return NextResponse.json(
      { error: "Failed to fetch teams" },
      { status: 500 },
    );
  }
}

// ─── POST /api/teams ────────────────────────────────────────────────────────
// Create a new team. Body: { name, repoUrl, slackChannelId, envContent, appUrl? }

function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  try {
    // Normalize: remove trailing slash, remove .git suffix
    let cleaned = url
      .trim()
      .replace(/\/+$/, "")
      .replace(/\.git$/, "");

    const parsed = new URL(cleaned);

    if (parsed.hostname !== "github.com") {
      return null;
    }

    // pathname looks like "/org/repo"
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }

    return { owner: segments[0], name: segments[1] };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, repoUrl, slackChannelId, envContent, appUrl } = body as {
      name?: string;
      repoUrl?: string;
      slackChannelId?: string;
      envContent?: string;
      appUrl?: string;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (
      !repoUrl ||
      typeof repoUrl !== "string" ||
      repoUrl.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "repoUrl is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (
      !slackChannelId ||
      typeof slackChannelId !== "string" ||
      slackChannelId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "slackChannelId is required and must be a non-empty string",
        },
        { status: 400 },
      );
    }

    if (
      !envContent ||
      typeof envContent !== "string" ||
      envContent.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "envContent is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Invalid GitHub URL. Expected format: https://github.com/owner/repo",
        },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(teams)
      .values({
        name: name.trim(),
        repoUrl: repoUrl.trim(),
        repoOwner: parsed.owner,
        repoName: parsed.name,
        slackChannelId: slackChannelId.trim(),
        envContent: envContent.trim(),
        ...(appUrl && appUrl.trim().length > 0
          ? { appUrl: appUrl.trim() }
          : {}),
      })
      .returning();

    let welcomeSent = true;
    try {
      await sendWelcomeMessage(
        created.slackChannelId!,
        created.name,
        created.repoUrl,
        {
          teamId: created.id,
          appUrl: created.appUrl ?? null,
        },
      );
    } catch (err) {
      console.error("Failed to send welcome message to Slack:", err);
      welcomeSent = false;
    }

    return NextResponse.json({ ...created, welcomeSent }, { status: 201 });
  } catch (error: any) {
    // Handle unique constraint violation on team name
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A team with this name already exists" },
        { status: 409 },
      );
    }

    console.error("POST /api/teams error:", error);
    return NextResponse.json(
      { error: "Failed to create team" },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/teams ──────────────────────────────────────────────────────
// Update team fields. Body: { id: string, slackChannelId?: string | null }

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, slackChannelId, appUrl, envContent } = body as {
      id?: string;
      slackChannelId?: string | null;
      appUrl?: string | null;
      envContent?: string | null;
    };

    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return NextResponse.json(
        { error: "id is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const updateFields: Record<string, unknown> = {};

    if (slackChannelId !== undefined) {
      updateFields.slackChannelId =
        slackChannelId && slackChannelId.trim().length > 0
          ? slackChannelId.trim()
          : null;
    }

    if (appUrl !== undefined) {
      updateFields.appUrl =
        appUrl && appUrl.trim().length > 0 ? appUrl.trim() : null;
    }

    if (envContent !== undefined) {
      updateFields.envContent =
        envContent && envContent.trim().length > 0 ? envContent.trim() : null;
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(teams)
      .set(updateFields)
      .where(eq(teams.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/teams error:", error);
    return NextResponse.json(
      { error: "Failed to update team" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/teams ──────────────────────────────────────────────────────
// Delete a team by id. Query param: ?id=xxx

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 },
      );
    }

    // Delete child rows first (FK constraints)
    await db
      .delete(featureCompletions)
      .where(eq(featureCompletions.teamId, id));
    await db.delete(scores).where(eq(scores.teamId, id));
    await db.delete(achievements).where(eq(achievements.teamId, id));
    await db.delete(events).where(eq(events.teamId, id));
    await db.delete(cursorMetrics).where(eq(cursorMetrics.teamId, id));
    await db.delete(analyses).where(eq(analyses.teamId, id));
    await db
      .delete(votes)
      .where(or(eq(votes.voterTeamId, id), eq(votes.votedForTeamId, id)));

    const [deleted] = await db
      .delete(teams)
      .where(eq(teams.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("DELETE /api/teams error:", error);
    return NextResponse.json(
      { error: "Failed to delete team" },
      { status: 500 },
    );
  }
}
