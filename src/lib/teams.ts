import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";

export type TeamRow = typeof teams.$inferSelect;

/** Returns the team row for the given GitHub owner/repo, or null if not found. */
export async function getTeamByRepo(
  owner: string,
  repo: string,
): Promise<TeamRow | null> {
  const [row] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.repoOwner, owner), eq(teams.repoName, repo)));
  return row ?? null;
}
