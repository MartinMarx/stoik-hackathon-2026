import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { votePhase } from "@/lib/db/schema";
import { globalEmitter } from "@/lib/events/emitter";
import { verifyToken } from "@/app/api/auth/route";
import { buildVotesResponse } from "../route";

const COOKIE_NAME = "admin_session";

function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD env var is not set");
  return pw;
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

    const payload = await buildVotesResponse();
    globalEmitter.emit("vote", payload);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("POST /api/votes/end error:", error);
    return NextResponse.json(
      { error: "Failed to end vote" },
      { status: 500 },
    );
  }
}
