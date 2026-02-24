import { NextRequest } from "next/server";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { db } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getTeamByRepo } from "@/lib/teams";
import { getUnlockedAchievementsForTeam } from "@/lib/achievements/resolve";
import { getConfigBool, CONFIG_KEYS } from "@/lib/config";

async function getLatestAnalysisPayload(teamId: string) {
  const [latest] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.teamId, teamId))
    .orderBy(desc(analyses.completedAt))
    .limit(1);
  if (!latest) return null;
  const result = latest.result as Record<string, unknown> | null;
  if (!result || typeof result !== "object") return { ...latest };
  return {
    ...latest,
    result: {
      ...result,
      achievements: await getUnlockedAchievementsForTeam(teamId),
    },
  };
}

function parseRepository(
  repository: string,
): { owner: string; repo: string } | null {
  const parts = repository.trim().split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "get_team_credentials",
      "Returns the team object for a given GitHub repository (owner/repo), including private keys: Anthropic API key and Railway token.",
      { repository: z.string() },
      async ({ repository }) => {
        const parsed = parseRepository(repository);
        if (!parsed) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Invalid repository. Use format: owner/repo",
                }),
              },
            ],
          };
        }
        const team = await getTeamByRepo(parsed.owner, parsed.repo);
        if (!team) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Team not found for repository ${repository}`,
                }),
              },
            ],
          };
        }
        const payload = {
          id: team.id,
          name: team.name,
          repoOwner: team.repoOwner,
          repoName: team.repoName,
          repoUrl: team.repoUrl,
          appUrl: team.appUrl ?? null,
          slackChannelId: team.slackChannelId ?? null,
          anthropicApiKey: team.anthropicApiKey ?? null,
          railwayToken: team.railwayToken ?? null,
          envContent: team.envContent ?? null,
          createdAt: team.createdAt.toISOString(),
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload) }],
        };
      },
    );

    server.tool(
      "get_team_stats",
      "Returns stats for a team identified by GitHub repository (owner/repo): latest analysis, score, achievements, cursor metrics, git stats, etc., as JSON.",
      { repository: z.string() },
      async ({ repository }) => {
        const parsed = parseRepository(repository);
        if (!parsed) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Invalid repository. Use format: owner/repo",
                }),
              },
            ],
          };
        }
        const team = await getTeamByRepo(parsed.owner, parsed.repo);
        if (!team) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Team not found for repository ${repository}`,
                }),
              },
            ],
          };
        }
        const stats = await getLatestAnalysisPayload(team.id);
        if (!stats) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  teamId: team.id,
                  team: team.name,
                  repoOwner: team.repoOwner,
                  repoName: team.repoName,
                  error: "No analysis found for this team",
                }),
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(stats, (_key, value) =>
                value instanceof Date ? value.toISOString() : value,
              ),
            },
          ],
        };
      },
    );
  },
  {},
  { basePath: "/api", maxDuration: 60 },
);

async function withPauseCheck(req: NextRequest) {
  const { NextResponse } = await import("next/server");
  try {
    if (await getConfigBool(CONFIG_KEYS.MCP_PAUSED)) {
      return NextResponse.json(
        { error: "MCP server is paused" },
        { status: 503 },
      );
    }
    const res = await handler(req);
    if (res instanceof Response) return res;
    return NextResponse.json(
      { error: "MCP handler did not return a response" },
      { status: 500 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return withPauseCheck(req);
}
export async function POST(req: NextRequest) {
  return withPauseCheck(req);
}
export async function DELETE(req: NextRequest) {
  return withPauseCheck(req);
}
