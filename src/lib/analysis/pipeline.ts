import { db } from "@/lib/db";
import {
  teams,
  analyses,
  cursorMetrics as cursorMetricsTable,
  achievements as achievementsTable,
  events,
  scores,
  featureCompletions,
  features,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type {
  TeamAnalysis,
  CursorMetricsData,
  FeatureComplianceResult,
  HackathonFeature,
} from "@/types";

// GitHub
import {
  fetchSourceCode,
  fetchPackageJson,
  fetchFileContent,
  fetchDirectory,
  fetchChangedFiles,
  fetchFilesByPaths,
} from "@/lib/github/client";

// Analyzers
import { analyzeCursorStructure } from "@/lib/analyzers/cursor-structure";
import { parseCursorEvents } from "@/lib/analyzers/cursor-events";
import { analyzeGit } from "@/lib/analyzers/git";
import {
  reviewCode,
  reviewCodeIncremental,
  checkFeatureCompliance,
} from "@/lib/analyzers/ai-reviewer";

// Engines
import { calculateScore, getTotalScore } from "@/lib/scoring/engine";
import { evaluateAchievements } from "@/lib/achievements/engine";
import { getAchievementById } from "@/lib/achievements/definitions";
import { resolveAchievementDefinition } from "@/lib/achievements/resolve";

// Slack
import {
  sendAnalysisCompleteCombined,
  sendTeamAnalysisProgress,
} from "@/lib/slack/client";
import { globalEmitter } from "@/lib/events/emitter";

// ---------------------------------------------------------------------------
// Helper: map DB feature row to HackathonFeature type (Date → string)
// ---------------------------------------------------------------------------

type DbFeature = typeof features.$inferSelect;

function toHackathonFeature(row: DbFeature): HackathonFeature {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    criteria: row.criteria,
    points: row.points,
    difficulty: row.difficulty as HackathonFeature["difficulty"],
    status: row.status as HackathonFeature["status"],
    createdAt: row.createdAt.toISOString(),
    announcedAt: row.announcedAt?.toISOString(),
    announcedBy: row.announcedBy ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Helper: fetch and merge all cursor analytics event files (events-*.jsonl per user)
// and optional legacy events.jsonl; merge and sort by ts for chronological order.
// ---------------------------------------------------------------------------

async function fetchMergedCursorEvents(
  owner: string,
  repo: string,
): Promise<string | null> {
  const analyticsDir = ".cursor/.analytics";
  const entries = await fetchDirectory(owner, repo, analyticsDir);
  const eventFiles = entries.filter(
    (e) =>
      e.type === "file" &&
      e.name.startsWith("events-") &&
      e.name.endsWith(".jsonl"),
  );
  const paths = eventFiles.map((e) => e.path);
  const contents = await Promise.all(
    paths.map((p) => fetchFileContent(owner, repo, p)),
  );
  const lines: { ts: string; raw: string }[] = [];
  for (const content of contents) {
    if (!content) continue;
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as { ts?: string; timestamp?: string };
        const ts = obj.ts ?? obj.timestamp ?? "";
        lines.push({ ts, raw: trimmed });
      } catch {
        lines.push({ ts: "", raw: trimmed });
      }
    }
  }
  if (lines.length === 0) {
    const legacy = await fetchFileContent(
      owner,
      repo,
      `${analyticsDir}/events.jsonl`,
    );
    return legacy;
  }
  lines.sort((a, b) => a.ts.localeCompare(b.ts));
  return lines.map((l) => l.raw).join("\n");
}

// ---------------------------------------------------------------------------
// Helper: default cursor metrics when events are unavailable
// ---------------------------------------------------------------------------

function defaultCursorMetrics(): CursorMetricsData {
  return {
    totalPrompts: 0,
    totalToolUses: 0,
    toolUseBreakdown: {},
    totalSessions: 0,
    modelsUsed: [],
    agentThoughtsCount: 0,
    fileEditsCount: 0,
    shellExecutionsCount: 0,
    mcpExecutionsCount: 0,
    avgResponseTimeMs: 0,
    totalEvents: 0,
    firstEventAt: null,
    lastEventAt: null,
  };
}

// ---------------------------------------------------------------------------
// Helper: fetch full source + package.json in parallel
// ---------------------------------------------------------------------------

async function fetchFullSource(owner: string, repo: string) {
  const [files, packageJson] = await Promise.all([
    fetchSourceCode(owner, repo),
    fetchPackageJson(owner, repo),
  ]);
  return { files, packageJson, isIncremental: false as const };
}

// ---------------------------------------------------------------------------
// Helper: fetch only changed files for incremental review
// ---------------------------------------------------------------------------

async function fetchChangedFilesForReview(
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
) {
  const [changedPaths, packageJson, allSourceFiles] = await Promise.all([
    fetchChangedFiles(owner, repo, baseSha, headSha),
    fetchPackageJson(owner, repo),
    fetchSourceCode(owner, repo), // we need full file list for paths
  ]);

  // Filter to only source files that changed
  const changedSourcePaths = changedPaths.filter(
    (p) => p.startsWith("src/") || p.startsWith("app/"),
  );

  const files = await fetchFilesByPaths(owner, repo, changedSourcePaths);

  return {
    files,
    packageJson,
    allFilesPaths: allSourceFiles.map((f) => f.path),
    isIncremental: true as const,
    changedPaths: changedSourcePaths,
  };
}

// ---------------------------------------------------------------------------
// Main analysis pipeline
// ---------------------------------------------------------------------------

export async function runAnalysis(
  teamId: string,
  commitSha: string,
  triggeredBy: "webhook" | "manual",
): Promise<TeamAnalysis> {
  // 1. Look up the team
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));

  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const owner = team.repoOwner;
  const repo = team.repoName;

  // 2. Create analysis record with status "running"
  const [analysis] = await db
    .insert(analyses)
    .values({
      teamId,
      triggeredBy,
      commitSha,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  // Notify team channel that analysis has started
  if (team.slackChannelId) {
    sendTeamAnalysisProgress(team.slackChannelId, team.name, "started", {
      commitSha,
      repoOwner: team.repoOwner,
      repoName: team.repoName,
    }).catch(console.error);
  }

  globalEmitter.emit("analysis", {
    type: "analysis:started",
    teamId,
    teamName: team.name,
    timestamp: new Date().toISOString(),
  });

  try {
    // 3. Check for previous completed analysis (for incremental review)
    const previousAnalysis = await db
      .select()
      .from(analyses)
      .where(and(eq(analyses.teamId, teamId), eq(analyses.status, "completed")))
      .orderBy(desc(analyses.completedAt))
      .limit(1);

    // 4. Fetch data in parallel (4 tracks)
    const [sourceResult, cursorStructure, eventsJsonl, gitMetrics] =
      await Promise.all([
        // Track A: Source code (full or changed files)
        previousAnalysis.length > 0 && previousAnalysis[0].commitSha
          ? fetchChangedFilesForReview(
              owner,
              repo,
              previousAnalysis[0].commitSha,
              commitSha,
            )
          : fetchFullSource(owner, repo),
        // Track B: Cursor structure
        analyzeCursorStructure(owner, repo),
        // Track C: Cursor events (merged from all events-*.jsonl per user, sorted by ts)
        fetchMergedCursorEvents(owner, repo),
        // Track D: Git
        analyzeGit(owner, repo),
      ]);

    // 5. Parse cursor events
    const cursorMetricsData = eventsJsonl
      ? parseCursorEvents(eventsJsonl)
      : defaultCursorMetrics();

    // 6. Fetch announced features from DB
    const announcedFeatures = await db
      .select()
      .from(features)
      .where(eq(features.status, "announced"));

    // 7. AI Review (incremental or full)
    let aiReview;
    if (sourceResult.isIncremental && previousAnalysis[0]?.result) {
      const previousResult = (previousAnalysis[0].result as TeamAnalysis)
        .aiReview;
      aiReview = await reviewCodeIncremental(
        sourceResult.files,
        previousResult,
        sourceResult.allFilesPaths ?? [],
        sourceResult.packageJson,
        announcedFeatures.map(toHackathonFeature),
      );
    } else {
      // Need full source for full review
      const fullSource = sourceResult.isIncremental
        ? await fetchSourceCode(owner, repo) // fallback: fetch everything
        : sourceResult.files;
      aiReview = await reviewCode(
        fullSource,
        sourceResult.packageJson,
        announcedFeatures.map(toHackathonFeature),
      );
    }

    // 8. Feature compliance (if there are announced features)
    let featuresComplianceResults: FeatureComplianceResult[] = [];
    if (announcedFeatures.length > 0) {
      const sourceForFeatures = sourceResult.isIncremental
        ? await fetchSourceCode(owner, repo)
        : sourceResult.files;
      featuresComplianceResults = await checkFeatureCompliance(
        sourceForFeatures,
        announcedFeatures.map(toHackathonFeature),
      );
    }

    // 9. Calculate score
    const scoreBreakdown = calculateScore(
      cursorStructure,
      cursorMetricsData,
      gitMetrics,
      aiReview,
      featuresComplianceResults,
      announcedFeatures.map(toHackathonFeature),
    );
    const totalScore = getTotalScore(scoreBreakdown);

    // 10. Evaluate achievements
    const previousAchievements = await db
      .select({
        achievementId: achievementsTable.achievementId,
        unlockedAt: achievementsTable.unlockedAt,
        data: achievementsTable.data,
      })
      .from(achievementsTable)
      .where(eq(achievementsTable.teamId, teamId));

    const newAchievements = evaluateAchievements({
      cursor: cursorStructure,
      cursorMetrics: cursorMetricsData,
      git: gitMetrics,
      aiReview,
      score: scoreBreakdown,
      featuresCompliance: featuresComplianceResults,
      previouslyUnlocked: previousAchievements.map((a) => a.achievementId),
      hackathonStartTime: process.env.HACKATHON_START,
      packageJson: sourceResult.packageJson,
    });

    const resolvedPrevious = await Promise.all(
      previousAchievements.map(async (a) => {
        const def = await resolveAchievementDefinition(a.achievementId);
        if (!def) return null;
        return {
          ...def,
          unlockedAt: a.unlockedAt.toISOString(),
          data: (a.data as Record<string, unknown>) ?? undefined,
        };
      }),
    );
    const previousUnlocked = resolvedPrevious.filter(
      (u): u is NonNullable<(typeof resolvedPrevious)[number]> => u !== null,
    );

    const teamAnalysis: TeamAnalysis = {
      team: team.name,
      teamId: team.id,
      analyzedAt: new Date().toISOString(),
      commitSha,
      cursor: cursorStructure,
      cursorMetrics: cursorMetricsData,
      git: gitMetrics,
      aiReview,
      featuresCompliance: featuresComplianceResults,
      score: scoreBreakdown,
      totalScore,
      achievements: [
        ...previousUnlocked,
        ...newAchievements.map((a) => {
          const def = getAchievementById(a.id);
          return {
            id: def?.id ?? a.id,
            name: def?.name ?? a.id,
            description: def?.description ?? "",
            icon: def?.icon ?? "",
            rarity: def?.rarity ?? "common",
            category: def?.category ?? "implementation",
            unlockedAt: new Date().toISOString(),
            data: a.data,
          };
        }),
      ],
      recommendations: aiReview.recommendations,
    };

    // 12. Persist to DB (sequential inserts — Neon HTTP doesn't support transactions)

    // 12a. Update analysis record
    await db
      .update(analyses)
      .set({
        status: "completed",
        result: teamAnalysis,
        completedAt: new Date(),
      })
      .where(eq(analyses.id, analysis.id));

    // 12b. Insert cursor metrics
    await db.insert(cursorMetricsTable).values({
      teamId,
      analysisId: analysis.id,
      totalPrompts: cursorMetricsData.totalPrompts,
      totalToolUses: cursorMetricsData.totalToolUses,
      toolUseBreakdown: cursorMetricsData.toolUseBreakdown,
      totalSessions: cursorMetricsData.totalSessions,
      modelsUsed: cursorMetricsData.modelsUsed,
      agentThoughtsCount: cursorMetricsData.agentThoughtsCount,
      fileEditsCount: cursorMetricsData.fileEditsCount,
      shellExecutionsCount: cursorMetricsData.shellExecutionsCount,
      mcpExecutionsCount: cursorMetricsData.mcpExecutionsCount,
      avgResponseTimeMs: cursorMetricsData.avgResponseTimeMs,
      totalEvents: cursorMetricsData.totalEvents,
      firstEventAt: cursorMetricsData.firstEventAt
        ? new Date(cursorMetricsData.firstEventAt)
        : null,
      lastEventAt: cursorMetricsData.lastEventAt
        ? new Date(cursorMetricsData.lastEventAt)
        : null,
      rawStats: cursorMetricsData,
    });

    // 12c. Insert scores snapshot
    await db.insert(scores).values({
      teamId,
      breakdown: scoreBreakdown,
      total: Math.round(totalScore),
    });

    // 12d. Insert new achievements
    for (const achievement of newAchievements) {
      await db.insert(achievementsTable).values({
        teamId,
        achievementId: achievement.id,
        data: achievement.data ?? null,
        notified: false,
      });
    }

    // 12e. Upsert feature completions
    for (const result of featuresComplianceResults) {
      await db
        .insert(featureCompletions)
        .values({
          teamId,
          featureId: result.featureId,
          status: result.status,
          confidence: result.confidence,
          details: result.details ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [featureCompletions.teamId, featureCompletions.featureId],
          set: {
            status: result.status,
            confidence: result.confidence,
            details: result.details ?? null,
            updatedAt: new Date(),
          },
        });
    }

    // 12f. Insert events for new achievements
    for (const achievement of newAchievements) {
      const def = getAchievementById(achievement.id);
      await db.insert(events).values({
        teamId,
        type: "achievement",
        data: {
          achievementId: achievement.id,
          name: def?.name ?? achievement.id,
          rarity: def?.rarity ?? "common",
        },
        points: null,
      });
    }

    // 12g. Insert score change event
    await db.insert(events).values({
      teamId,
      type: "score_change",
      data: {
        total: totalScore,
        breakdown: scoreBreakdown,
        commitSha,
      },
      points: Math.round(totalScore),
    });

    // 12h. Insert analysis event
    await db.insert(events).values({
      teamId,
      type: "analysis",
      data: {
        analysisId: analysis.id,
        triggeredBy,
        commitSha,
      },
      points: null,
    });

    // 13. Slack notifications (fire-and-forget)

    const previousScoreRecord = await db
      .select()
      .from(scores)
      .where(eq(scores.teamId, teamId))
      .orderBy(desc(scores.recordedAt))
      .limit(1)
      .offset(1);

    const prevScore = previousScoreRecord[0]?.total ?? null;
    const achievementDefs = newAchievements
      .map((a) => getAchievementById(a.id))
      .filter((def): def is NonNullable<typeof def> => def != null);

    sendAnalysisCompleteCombined(
      team.name,
      totalScore,
      prevScore,
      achievementDefs,
    ).catch(console.error);

    if (team.slackChannelId) {
      sendTeamAnalysisProgress(team.slackChannelId, team.name, "completed", {
        commitSha,
        repoOwner: team.repoOwner,
        repoName: team.repoName,
        totalScore,
        previousScore: prevScore,
        teamId,
      }).catch(console.error);
    }

    globalEmitter.emit("analysis", {
      type: "analysis:completed",
      teamId,
      teamName: team.name,
      timestamp: new Date().toISOString(),
      data: { totalScore, previousScore: prevScore ?? undefined },
    });

    // 14. Return
    return teamAnalysis;
  } catch (error) {
    // On error: mark analysis as failed
    await db
      .update(analyses)
      .set({
        status: "failed",
        result: {
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
        completedAt: new Date(),
      })
      .where(eq(analyses.id, analysis.id));

    globalEmitter.emit("analysis", {
      type: "analysis:failed",
      teamId,
      teamName: team.name,
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
}
