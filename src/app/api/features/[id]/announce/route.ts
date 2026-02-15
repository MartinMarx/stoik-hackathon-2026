import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { features } from "@/lib/db/schema";
import { announceFeature } from "@/lib/slack/client";
import type { HackathonFeature } from "@/types";

// ─── POST /api/features/[id]/announce ───────────────────────────────────────
// Announce a feature: update status to "announced", set announcedAt, and post to Slack.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Find the feature first
    const [feature] = await db
      .select()
      .from(features)
      .where(eq(features.id, id));

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    // Update status to announced
    const [updated] = await db
      .update(features)
      .set({
        status: "announced",
        announcedAt: new Date(),
      })
      .where(eq(features.id, id))
      .returning();

    // Post to Slack
    const slackFeature: HackathonFeature = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      criteria: updated.criteria,
      points: updated.points,
      difficulty: updated.difficulty as HackathonFeature["difficulty"],
      status: updated.status as HackathonFeature["status"],
      createdAt: updated.createdAt.toISOString(),
      announcedAt: updated.announcedAt?.toISOString(),
      announcedBy: updated.announcedBy ?? undefined,
    };

    await announceFeature(slackFeature);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/features/[id]/announce error:", error);
    return NextResponse.json(
      { error: "Failed to announce feature" },
      { status: 500 },
    );
  }
}
