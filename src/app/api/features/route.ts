import { NextRequest, NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { featureCompletions, features } from "@/lib/db/schema";

// ─── GET /api/features ──────────────────────────────────────────────────────
// List all features ordered by createdAt desc, with teamsAchievedCount.

export async function GET() {
  try {
    const allFeatures = await db
      .select()
      .from(features)
      .orderBy(desc(features.createdAt));

    const achievedCounts = await db
      .select({
        featureId: featureCompletions.featureId,
        count: count(),
      })
      .from(featureCompletions)
      .where(eq(featureCompletions.status, "implemented"))
      .groupBy(featureCompletions.featureId);

    const countByFeatureId = Object.fromEntries(
      achievedCounts.map((r) => [r.featureId, Number(r.count)]),
    );

    const withCounts = allFeatures.map((f) => ({
      ...f,
      teamsAchievedCount: countByFeatureId[f.id] ?? 0,
    }));

    return NextResponse.json(withCounts);
  } catch (error) {
    console.error("GET /api/features error:", error);
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 },
    );
  }
}

// ─── POST /api/features ─────────────────────────────────────────────────────
// Create a new feature. Body: { title, description, criteria, points, difficulty }

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { title, description, criteria, points, difficulty } = body as {
      title?: string;
      description?: string;
      criteria?: string[];
      points?: number;
      difficulty?: string;
    };

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "title is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "description is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (!Array.isArray(criteria) || criteria.length === 0) {
      return NextResponse.json(
        { error: "criteria is required and must be a non-empty array of strings" },
        { status: 400 },
      );
    }

    if (typeof points !== "number" || points < 0) {
      return NextResponse.json(
        { error: "points is required and must be a non-negative number" },
        { status: 400 },
      );
    }

    if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json(
        { error: "difficulty is required and must be one of: easy, medium, hard" },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(features)
      .values({
        title: title.trim(),
        description: description.trim(),
        criteria,
        points,
        difficulty,
        status: "draft",
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/features error:", error);
    return NextResponse.json(
      { error: "Failed to create feature" },
      { status: 500 },
    );
  }
}
