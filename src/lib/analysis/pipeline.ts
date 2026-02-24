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
import { eq, desc } from "drizzle-orm";
import type {
  TeamAnalysis,
  ScoreBreakdown,
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
  fetchJsonlContent,
  capJsonlForParsing,
} from "@/lib/github/client";
// Analyzers
import { analyzeCursorStructure } from "@/lib/analyzers/cursor-structure";
import { parseCursorEvents } from "@/lib/analyzers/cursor-events";
import { analyzeGit } from "@/lib/analyzers/git";
import {
  reviewCode,
  checkFeatureCompliance,
  evaluateAgenticFiles,
} from "@/lib/analyzers/ai-reviewer";

// Engines
import { calculateScore, getTotalScore } from "@/lib/scoring/engine";
import { evaluateAchievements } from "@/lib/achievements/engine";
import {
  getAchievementById,
  RARITY_POINTS,
} from "@/lib/achievements/definitions";
import { batchResolveAchievementDefinitions } from "@/lib/achievements/resolve";

// Slack
import {
  sendPublicAchievements,
  sendPrivateAchievements,
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

const MAX_CURSOR_EVENT_LINES = 200_000;

const runningAnalysisByTeam = new Map<string, AbortController>();

export class AnalysisCancelledError extends Error {
  constructor() {
    super("Analysis cancelled by new webhook");
    this.name = "AnalysisCancelledError";
  }
}

export function cancelRunningAnalysisForTeam(teamId: string): void {
  const controller = runningAnalysisByTeam.get(teamId);
  if (controller) {
    controller.abort();
    runningAnalysisByTeam.delete(teamId);
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new AnalysisCancelledError();
}

function getBreakdownTotal(b: unknown, key: string): number {
  const obj = b as Record<string, { total?: number } | undefined> | null;
  return obj?.[key]?.total ?? 0;
}

/**
 * Build a short summary of why the score changed between this and the previous analysis.
 */
function buildScoreChangeSummary(
  current: ScoreBreakdown,
  previous: unknown,
  newAchievementsCount: number,
): string {
  if (previous == null) return "First score recorded.";
  const prevImp = getBreakdownTotal(previous, "implementation");
  const prevQual = getBreakdownTotal(previous, "codeQuality");
  const prevGit = getBreakdownTotal(previous, "gitActivity");
  const prevCursor = getBreakdownTotal(previous, "cursorActivity");
  const prevBonus = getBreakdownTotal(previous, "bonusFeatures");
  const prevAchieve = getBreakdownTotal(previous, "achievementBonus");
  const currImp = current.implementation.total;
  const currQual = current.codeQuality.total;
  const currGit = current.gitActivity.total;
  const currCursor = current.cursorActivity.total;
  const currBonus = current.bonusFeatures?.total ?? 0;
  const currAchieve = current.achievementBonus?.total ?? 0;
  const deltas: string[] = [];
  if (currImp !== prevImp)
    deltas.push(
      `Implementation ${currImp > prevImp ? "+" : ""}${currImp - prevImp}`,
    );
  if (currQual !== prevQual)
    deltas.push(
      `Code quality ${currQual > prevQual ? "+" : ""}${currQual - prevQual}`,
    );
  if (currGit !== prevGit)
    deltas.push(
      `Git activity ${currGit > prevGit ? "+" : ""}${currGit - prevGit}`,
    );
  if (currCursor !== prevCursor)
    deltas.push(
      `Cursor activity ${currCursor > prevCursor ? "+" : ""}${currCursor - prevCursor}`,
    );
  if (currBonus !== prevBonus)
    deltas.push(
      `Bonus features ${currBonus > prevBonus ? "+" : ""}${currBonus - prevBonus}`,
    );
  if (currAchieve !== prevAchieve || newAchievementsCount > 0) {
    const delta = currAchieve - prevAchieve;
    if (delta !== 0)
      deltas.push(`Achievements ${delta > 0 ? "+" : ""}${delta}`);
    else if (newAchievementsCount > 0)
      deltas.push(`${newAchievementsCount} new achievement(s)`);
  }
  if (deltas.length === 0) return "Score unchanged.";
  return deltas.join(". ");
}

/**
 * Fetch and merge cursor event files, capping total lines while merging
 * to avoid loading huge event sets into memory.
 */
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
    paths.map((p) => fetchJsonlContent(owner, repo, p)),
  );
  const lines: { ts: string; raw: string }[] = [];
  for (const content of contents) {
    if (lines.length >= MAX_CURSOR_EVENT_LINES) break;
    if (!content) continue;
    for (const line of content.split("\n")) {
      if (lines.length >= MAX_CURSOR_EVENT_LINES) break;
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
    const legacy = await fetchJsonlContent(
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
    mcpServersCount: 0,
    avgResponseTimeMs: 0,
    totalEvents: 0,
    firstEventAt: null,
    lastEventAt: null,
  };
}

// ---------------------------------------------------------------------------
// Helper: fetch full source + package.json in parallel
// ---------------------------------------------------------------------------

async function fetchFullSource(owner: string, repo: string, ref: string) {
  const [files, packageJson] = await Promise.all([
    fetchSourceCode(owner, repo, ref),
    fetchPackageJson(owner, repo, ref),
  ]);
  return { files, packageJson };
}

// ---------------------------------------------------------------------------
// Main analysis pipeline
// ---------------------------------------------------------------------------

export async function runAnalysis(
  teamId: string,
  commitSha: string,
  triggeredBy: "webhook" | "manual",
): Promise<TeamAnalysis> {
  cancelRunningAnalysisForTeam(teamId);
  const controller = new AbortController();
  const signal = controller.signal;
  runningAnalysisByTeam.set(teamId, controller);
  try {
    return await runAnalysisWithSignal(teamId, commitSha, triggeredBy, signal);
  } finally {
    if (runningAnalysisByTeam.get(teamId) === controller) {
      runningAnalysisByTeam.delete(teamId);
    }
  }
}

async function runAnalysisWithSignal(
  teamId: string,
  commitSha: string,
  triggeredBy: "webhook" | "manual",
  signal: AbortSignal,
): Promise<TeamAnalysis> {
  throwIfAborted(signal);
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));

  if (!team) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const owner = team.repoOwner;
  const repo = team.repoName;

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
  // if (team.slackChannelId) {
  //   sendTeamAnalysisProgress(team.slackChannelId, team.name, "started", {
  //     commitSha,
  //     repoOwner: team.repoOwner,
  //     repoName: team.repoName,
  //   }).catch(console.error);
  // }

  globalEmitter.emit("analysis", {
    type: "analysis:started",
    teamId,
    teamName: team.name,
    timestamp: new Date().toISOString(),
  });

  const pipelineStart = Date.now();
  console.log(
    `[analyze] ${team.name} @ ${commitSha.slice(0, 7)} — starting pipeline`,
  );

  try {
    let phaseStart = Date.now();
    const [sourceResult, cursorStructure, eventsJsonl, gitMetrics] =
      await Promise.all([
        (async () => {
          const t = Date.now();
          const r = await fetchFullSource(owner, repo, commitSha);
          console.log(
            `[analyze] fetch fetchFullSource: ${((Date.now() - t) / 1000).toFixed(1)}s (${r.files.length} files)`,
          );
          return r;
        })(),
        (async () => {
          const t = Date.now();
          const r = await analyzeCursorStructure(owner, repo);
          console.log(
            `[analyze] fetch analyzeCursorStructure: ${((Date.now() - t) / 1000).toFixed(1)}s`,
          );
          return r;
        })(),
        (async () => {
          const t = Date.now();
          const r = await fetchMergedCursorEvents(owner, repo);
          const lines =
            r != null ? r.split("\n").filter((l) => l.trim()).length : 0;
          console.log(
            `[analyze] fetch fetchMergedCursorEvents: ${((Date.now() - t) / 1000).toFixed(1)}s (${lines} lines)`,
          );
          return r;
        })(),
        (async () => {
          const t = Date.now();
          const r = await analyzeGit(owner, repo);
          console.log(
            `[analyze] fetch analyzeGit: ${((Date.now() - t) / 1000).toFixed(1)}s`,
          );
          return r;
        })(),
      ]);
    console.log(
      `[analyze] Phase fetch (total): ${((Date.now() - phaseStart) / 1000).toFixed(1)}s`,
    );
    throwIfAborted(signal);

    phaseStart = Date.now();
    const cappedJsonl =
      eventsJsonl != null ? capJsonlForParsing(eventsJsonl) : null;
    const cursorMetricsData = cappedJsonl
      ? parseCursorEvents(cappedJsonl)
      : defaultCursorMetrics();
    console.log(
      `[analyze] Phase parseEvents: ${((Date.now() - phaseStart) / 1000).toFixed(1)}s`,
    );
    throwIfAborted(signal);

    phaseStart = Date.now();
    const announcedFeatures = await db
      .select()
      .from(features)
      .where(eq(features.status, "announced"));
    const fullSource = sourceResult.files;
    const announcedFeaturesList = announcedFeatures.map(toHackathonFeature);
    console.log(
      `[analyze] Phase dbFeatures: ${((Date.now() - phaseStart) / 1000).toFixed(1)}s`,
    );
    throwIfAborted(signal);

    phaseStart = Date.now();
    const [aiReview, featuresComplianceResults, agenticQuality] =
      await Promise.all([
        (async () => {
          const t = Date.now();
          const r = await reviewCode(
            fullSource,
            sourceResult.packageJson,
            announcedFeaturesList,
          );
          console.log(
            `[analyze] aiReview reviewCode: ${((Date.now() - t) / 1000).toFixed(1)}s`,
          );
          return r;
        })(),
        (async () => {
          if (announcedFeatures.length === 0)
            return [] as FeatureComplianceResult[];
          const t = Date.now();
          const r = await checkFeatureCompliance(
            fullSource,
            announcedFeaturesList,
          );
          console.log(
            `[analyze] aiReview checkFeatureCompliance: ${((Date.now() - t) / 1000).toFixed(1)}s`,
          );
          return r;
        })(),
        (async () => {
          const t = Date.now();
          const r = await evaluateAgenticFiles(cursorStructure);
          console.log(
            `[analyze] aiReview evaluateAgenticFiles: ${((Date.now() - t) / 1000).toFixed(1)}s`,
          );
          return r;
        })(),
      ]);
    console.log(
      `[analyze] Phase aiReview: ${((Date.now() - phaseStart) / 1000).toFixed(1)}s`,
    );
    throwIfAborted(signal);

    phaseStart = Date.now();
    const scoreBreakdown = calculateScore(
      cursorStructure,
      cursorMetricsData,
      gitMetrics,
      aiReview,
      featuresComplianceResults,
      announcedFeatures.map(toHackathonFeature),
      agenticQuality,
    );
    let totalScore = getTotalScore(scoreBreakdown);
    console.log(
      `[analyze] Phase calculateScore: ${((Date.now() - phaseStart) / 1000).toFixed(1)}s`,
    );
    throwIfAborted(signal);

    phaseStart = Date.now();
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
      agenticQuality,
      hackathonStartTime: process.env.HACKATHON_START,
      packageJson: sourceResult.packageJson,
    });

    const customDefs = await batchResolveAchievementDefinitions(
      previousAchievements.map((a) => a.achievementId),
    );
    const resolvedPrevious = previousAchievements.map((a) => {
      const def =
        getAchievementById(a.achievementId) ?? customDefs.get(a.achievementId);
      if (!def) return null;
      return {
        ...def,
        unlockedAt: a.unlockedAt.toISOString(),
        data: (a.data as Record<string, unknown>) ?? undefined,
      };
    });
    const previousUnlocked = resolvedPrevious.filter(
      (u): u is NonNullable<(typeof resolvedPrevious)[number]> => u !== null,
    );
    console.log(
      `[analyze] Phase resolveAchievements: ${((Date.now() - phaseStart) / 1000).toFixed(1)}s`,
    );
    throwIfAborted(signal);

    const allUnlocked = [
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
    ];
    const achievementBonusTotal = allUnlocked.reduce(
      (sum, a) => sum + (RARITY_POINTS[a.rarity] ?? 0),
      0,
    );
    scoreBreakdown.achievementBonus = {
      total: Math.round(achievementBonusTotal),
      count: allUnlocked.length,
    };
    totalScore = getTotalScore(scoreBreakdown);

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
      achievements: allUnlocked,
      recommendations: aiReview.recommendations,
    };

    phaseStart = Date.now();
    let stepStart = Date.now();
    await db
      .update(analyses)
      .set({
        status: "completed",
        result: teamAnalysis,
        completedAt: new Date(),
      })
      .where(eq(analyses.id, analysis.id));
    console.log(
      `[analyze] persist updateAnalysis: ${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
    );

    stepStart = Date.now();
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
    console.log(
      `[analyze] persist cursorMetrics: ${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
    );

    stepStart = Date.now();
    await db.insert(scores).values({
      teamId,
      breakdown: scoreBreakdown,
      total: Math.round(totalScore),
    });
    console.log(
      `[analyze] persist scores: ${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
    );

    stepStart = Date.now();
    await Promise.all([
      ...newAchievements.map((achievement) =>
        db.insert(achievementsTable).values({
          teamId,
          achievementId: achievement.id,
          data: achievement.data ?? null,
          notified: false,
        }),
      ),
      ...featuresComplianceResults.map((result) =>
        db
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
          }),
      ),
      ...newAchievements.map((achievement) => {
        const def = getAchievementById(achievement.id);
        return db.insert(events).values({
          teamId,
          type: "achievement",
          data: {
            achievementId: achievement.id,
            name: def?.name ?? achievement.id,
            rarity: def?.rarity ?? "common",
          },
          points: null,
        });
      }),
    ]);
    console.log(
      `[analyze] persist batch (achievements/features/events): ${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
    );

    stepStart = Date.now();
    const [previousScoreRow] = await db
      .select({ total: scores.total })
      .from(scores)
      .where(eq(scores.teamId, teamId))
      .orderBy(desc(scores.recordedAt))
      .limit(1)
      .offset(1);
    const previousTotal = previousScoreRow?.total ?? null;
    const scoreDelta = Math.round(totalScore) - (previousTotal ?? 0);

    await db.insert(events).values({
      teamId,
      type: "score_change",
      data: {
        total: totalScore,
        previousTotal: previousTotal ?? undefined,
        breakdown: scoreBreakdown,
        commitSha,
      },
      points: scoreDelta,
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
    console.log(
      `[analyze] persist score_change + analysis events: ${((Date.now() - stepStart) / 1000).toFixed(1)}s`,
    );
    console.log(
      `[analyze] Phase persist (total): ${((Date.now() - phaseStart) / 1000).toFixed(1)}s`,
    );

    const totalSec = (Date.now() - pipelineStart) / 1000;
    console.log(
      `[analyze] ${team.name} — done in ${totalSec.toFixed(1)}s (fetch | parse | dbFeatures | aiReview | score | resolve | persist)`,
    );

    // 13. Slack notifications (fire-and-forget)

    const previousScoreRecord = await db
      .select()
      .from(scores)
      .where(eq(scores.teamId, teamId))
      .orderBy(desc(scores.recordedAt))
      .limit(1)
      .offset(1);

    const prevScore = previousScoreRecord[0]?.total ?? null;
    const prevBreakdown = previousScoreRecord[0]?.breakdown ?? null;
    const scoreChangeSummary = buildScoreChangeSummary(
      scoreBreakdown,
      prevBreakdown,
      newAchievements.length,
    );
    const achievementDefs = newAchievements
      .map((a) => getAchievementById(a.id))
      .filter((def): def is NonNullable<typeof def> => def != null);

    if (achievementDefs.length > 0) {
      sendPublicAchievements(
        team.name,
        achievementDefs,
        team.memberNames ?? [],
      ).catch(console.error);
      if (team.slackChannelId) {
        sendPrivateAchievements(
          team.slackChannelId,
          team.name,
          achievementDefs,
        ).catch(console.error);
      }
    }
    // Notify team channel that analysis ended
    // if (team.slackChannelId) {
    //   sendTeamAnalysisProgress(team.slackChannelId, team.name, "completed", {
    //     commitSha,
    //     repoOwner: team.repoOwner,
    //     repoName: team.repoName,
    //     totalScore,
    //     previousScore: prevScore,
    //     teamId,
    //     scoreChangeSummary,
    //   }).catch(console.error);
    // }

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
    if (error instanceof AnalysisCancelledError) {
      await db
        .update(analyses)
        .set({ status: "cancelled", completedAt: new Date() })
        .where(eq(analyses.id, analysis.id));
      throw error;
    }
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
