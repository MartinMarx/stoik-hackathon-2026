import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { cancelRunningAnalysisForTeam } from "@/lib/analysis/pipeline";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [analysis] = await db
      .select({
        id: analyses.id,
        teamId: analyses.teamId,
        status: analyses.status,
      })
      .from(analyses)
      .where(eq(analyses.id, id));

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 },
      );
    }

    if (analysis.status !== "pending" && analysis.status !== "running") {
      return NextResponse.json(
        { error: `Cannot cancel analysis with status "${analysis.status}"` },
        { status: 400 },
      );
    }

    cancelRunningAnalysisForTeam(analysis.teamId);

    await db
      .update(analyses)
      .set({ status: "cancelled", completedAt: new Date() })
      .where(eq(analyses.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/analyses/cancel]", err);
    return NextResponse.json(
      { error: "Failed to cancel analysis" },
      { status: 500 },
    );
  }
}
