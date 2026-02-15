import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { features } from "@/lib/db/schema";

// ─── GET /api/features/[id] ─────────────────────────────────────────────────
// Get a single feature by ID.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [feature] = await db
      .select()
      .from(features)
      .where(eq(features.id, id));

    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    return NextResponse.json(feature);
  } catch (error) {
    console.error("GET /api/features/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feature" },
      { status: 500 },
    );
  }
}

// ─── PATCH /api/features/[id] ───────────────────────────────────────────────
// Update a feature. Body may contain: title, description, criteria, points, difficulty, status

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];
const VALID_STATUSES = ["draft", "announced", "archived"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { title, description, criteria, points, difficulty, status } = body as {
      title?: string;
      description?: string;
      criteria?: string[];
      points?: number;
      difficulty?: string;
      status?: string;
    };

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "title must be a non-empty string" },
          { status: 400 },
        );
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || description.trim().length === 0) {
        return NextResponse.json(
          { error: "description must be a non-empty string" },
          { status: 400 },
        );
      }
      updates.description = description.trim();
    }

    if (criteria !== undefined) {
      if (!Array.isArray(criteria) || criteria.length === 0) {
        return NextResponse.json(
          { error: "criteria must be a non-empty array of strings" },
          { status: 400 },
        );
      }
      updates.criteria = criteria;
    }

    if (points !== undefined) {
      if (typeof points !== "number" || points < 0) {
        return NextResponse.json(
          { error: "points must be a non-negative number" },
          { status: 400 },
        );
      }
      updates.points = points;
    }

    if (difficulty !== undefined) {
      if (!VALID_DIFFICULTIES.includes(difficulty)) {
        return NextResponse.json(
          { error: "difficulty must be one of: easy, medium, hard" },
          { status: 400 },
        );
      }
      updates.difficulty = difficulty;
    }

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: "status must be one of: draft, announced, archived" },
          { status: 400 },
        );
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(features)
      .set(updates)
      .where(eq(features.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/features/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update feature" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/features/[id] ──────────────────────────────────────────────
// Delete a feature by ID.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [deleted] = await db
      .delete(features)
      .where(eq(features.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("DELETE /api/features/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete feature" },
      { status: 500 },
    );
  }
}
