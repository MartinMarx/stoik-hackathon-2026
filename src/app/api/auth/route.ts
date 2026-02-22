import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) throw new Error("ADMIN_PASSWORD env var is not set");
  return pw;
}

function signToken(password: string): string {
  const payload = JSON.stringify({ auth: true, ts: Date.now() });
  const sig = createHmac("sha256", password).update(payload).digest("hex");
  return Buffer.from(JSON.stringify({ payload, sig })).toString("base64");
}

export function verifyToken(token: string, password: string): boolean {
  try {
    const { payload, sig } = JSON.parse(
      Buffer.from(token, "base64").toString("utf-8"),
    );
    const expected = createHmac("sha256", password)
      .update(payload)
      .digest("hex");
    return sig === expected;
  } catch {
    return false;
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = body?.password;
    const adminPassword = getAdminPassword();

    if (password !== adminPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = signToken(adminPassword);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
