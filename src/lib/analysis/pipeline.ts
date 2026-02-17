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

// Slack
import {
  announceAchievement,
  sendAnalysisComplete,
  sendTeamRecommendations,
  sendTeamAnalysisProgress,
} from "@/lib/slack/client";

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
// Helper: default cursor metrics when events.jsonl is unavailable
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
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId));

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
      repoOwner: owner,
      repoName: repo,
    }).catch(console.error);
  }

  try {
    // 3. Check for previous completed analysis (for incremental review)
    const previousAnalysis = await db
      .select()
      .from(analyses)
      .where(
        and(eq(analyses.teamId, teamId), eq(analyses.status, "completed")),
      )
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
        // Track C: Cursor events
        fetchFileContent(owner, repo, ".cursor/.analytics/events.jsonl"),
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
    if (
      sourceResult.isIncremental &&
      previousAnalysis[0]?.result
    ) {
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

    // 11. Build full TeamAnalysis object
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
        // Previously unlocked achievements
        ...previousAchievements.map((a) => {
          const def = getAchievementById(a.achievementId);
          return {
            id: def?.id ?? a.achievementId,
            name: def?.name ?? a.achievementId,
            description: def?.description ?? "",
            icon: def?.icon ?? "",
            rarity: def?.rarity ?? "common",
            category: def?.category ?? "implementation",
            unlockedAt: a.unlockedAt?.toISOString() ?? "",
            data: undefined,
          };
        }),
        // Newly unlocked achievements
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

    // Announce new achievements to GLOBAL channel (visible to everyone)
    for (const achievement of newAchievements) {
      const def = getAchievementById(achievement.id);
      if (def) {
        announceAchievement(team.name, def).catch(console.error);
      }
    }

    // Get previous score for comparison
    const previousScoreRecord = await db
      .select()
      .from(scores)
      .where(eq(scores.teamId, teamId))
      .orderBy(desc(scores.recordedAt))
      .limit(1)
      .offset(1); // skip the one we just inserted

    const prevScore = previousScoreRecord[0]?.total ?? null;

    // Send analysis complete to GLOBAL channel
    sendAnalysisComplete(
      team.name,
      totalScore,
      prevScore,
      newAchievements.length,
    ).catch(console.error);

    // Send to TEAM channel if configured
    if (team.slackChannelId) {
      // Analysis progress (completed with score) to team channel
      sendTeamAnalysisProgress(team.slackChannelId, team.name, "completed", {
        totalScore,
        previousScore: prevScore,
        commitSha,
        repoOwner: owner,
        repoName: repo,
      }).catch(console.error);

      // Recommendations to team channel
      if (aiReview.recommendations.length > 0) {
        sendTeamRecommendations(
          team.slackChannelId,
          team.name,
          aiReview.recommendations,
          totalScore,
        ).catch(console.error);
      }
    }

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

    throw error;
  }
}
