import { WebClient } from "@slack/web-api";
import type {
  HackathonFeature,
  LeaderboardEntry,
  AchievementDefinition,
  AchievementRarity,
} from "@/types";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const channel = process.env.SLACK_CHANNEL_ID!;

const RARITY_EMOJI: Record<AchievementRarity, string> = {
  common: "⬜",
  rare: "🟦",
  epic: "🟪",
  legendary: "🟨",
};

const DIFFICULTY_EMOJI: Record<string, string> = {
  easy: "🟢",
  medium: "🟡",
  hard: "🔴",
};

export function buildProgressBar(
  current: number,
  max: number,
  width: number = 16,
): string {
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)} ${current}/${max}`;
}

export async function announceFeature(
  feature: HackathonFeature,
): Promise<void> {
  try {
    const criteriaList = feature.criteria.map((c) => `• ${c}`).join("\n");

    const difficultyLabel =
      feature.difficulty.charAt(0).toUpperCase() + feature.difficulty.slice(1);

    const blocks = [
      {
        type: "header" as const,
        text: {
          type: "plain_text" as const,
          text: "🆕 New Feature Challenge!",
          emoji: true,
        },
      },
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: `*${feature.title}*\n${feature.description}`,
        },
      },
      {
        type: "section" as const,
        fields: [
          {
            type: "mrkdwn" as const,
            text: `💰 *${feature.points} pts*`,
          },
          {
            type: "mrkdwn" as const,
            text: `${DIFFICULTY_EMOJI[feature.difficulty]} *${difficultyLabel}*`,
          },
        ],
      },
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: `*Criteria:*\n${criteriaList}`,
        },
      },
      {
        type: "context" as const,
        elements: [
          {
            type: "mrkdwn" as const,
            text: `📅 Announced at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    ];

    await slack.chat.postMessage({
      channel,
      blocks,
      text: `🆕 New Feature Challenge: ${feature.title} (${feature.points} pts, ${difficultyLabel})`,
    });
  } catch (error) {
    console.error("Failed to announce feature to Slack:", error);
  }
}

export async function announceAchievement(
  teamName: string,
  achievement: AchievementDefinition,
  details?: string,
): Promise<void> {
  try {
    const rarityEmoji = RARITY_EMOJI[achievement.rarity];

    const contextElements = [
      {
        type: "mrkdwn" as const,
        text: achievement.description,
      },
    ];

    if (details) {
      contextElements.push({
        type: "mrkdwn" as const,
        text: details,
      });
    }

    const blocks = [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: `${achievement.icon} *${teamName}* unlocked ${rarityEmoji} *${achievement.name}*!`,
        },
      },
      {
        type: "context" as const,
        elements: contextElements,
      },
    ];

    await slack.chat.postMessage({
      channel,
      blocks,
      text: `${achievement.icon} ${teamName} unlocked ${achievement.name}!`,
    });
  } catch (error) {
    console.error("Failed to announce achievement to Slack:", error);
  }
}

export async function sendLeaderboard(
  entries: LeaderboardEntry[],
  maxScore: number,
): Promise<void> {
  try {
    const RANK_MEDALS: Record<number, string> = {
      1: "🥇",
      2: "🥈",
      3: "🥉",
    };

    const TREND_ARROWS: Record<string, string> = {
      up: "↗️",
      down: "↘️",
      stable: "➡️",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🏆 Leaderboard Update",
          emoji: true,
        },
      },
    ];

    for (const entry of entries) {
      const rankDisplay = RANK_MEDALS[entry.rank] ?? `*#${entry.rank}*`;
      const trendArrow = TREND_ARROWS[entry.trend];
      const progressBar = buildProgressBar(entry.totalScore, maxScore);

      const trendDetail =
        entry.previousRank != null && entry.previousRank !== entry.rank
          ? ` (was #${entry.previousRank})`
          : "";

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${rankDisplay} *${entry.team}* — ${entry.totalScore} pts ${trendArrow}${trendDetail}\n\`${progressBar}\``,
        },
      });
    }

    blocks.push({ type: "divider" });

    await slack.chat.postMessage({
      channel,
      blocks,
      text: `🏆 Leaderboard Update — ${entries.length} teams ranked`,
    });
  } catch (error) {
    console.error("Failed to send leaderboard to Slack:", error);
  }
}

export async function sendAnalysisComplete(
  teamName: string,
  totalScore: number,
  previousScore: number | null,
  newAchievements: number,
): Promise<void> {
  try {
    let scoreText: string;
    if (previousScore != null) {
      const diff = totalScore - previousScore;
      const sign = diff >= 0 ? "+" : "";
      scoreText = `📊 Score: ${previousScore} → ${totalScore} (${sign}${diff})`;
    } else {
      scoreText = `📊 Score: ${totalScore}`;
    }

    let achievementText = "";
    if (newAchievements > 0) {
      achievementText = `\n🏅 ${newAchievements} new achievement${newAchievements > 1 ? "s" : ""} unlocked!`;
    }

    const blocks = [
      {
        type: "section" as const,
        text: {
          type: "mrkdwn" as const,
          text: `✅ Analysis complete for *${teamName}*\n${scoreText}${achievementText}`,
        },
      },
    ];

    await slack.chat.postMessage({
      channel,
      blocks,
      text: `✅ Analysis complete for ${teamName} — Score: ${totalScore}`,
    });
  } catch (error) {
    console.error("Failed to send analysis complete to Slack:", error);
  }
}

// ─── Generic channel helper ─────────────────────────────────────────────────

export async function sendToChannel(
  channelId: string,
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: any[],
): Promise<void> {
  try {
    await slack.chat.postMessage({
      channel: channelId,
      text,
      ...(blocks ? { blocks } : {}),
    });
  } catch (error) {
    console.error(`Failed to send message to channel ${channelId}:`, error);
  }
}

// ─── Per-team: Recommendations ──────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  performance: "⚡",
  security: "🔒",
  structure: "🏗️",
  testing: "🧪",
  documentation: "📝",
  accessibility: "♿",
  ux: "🎨",
  general: "💡",
};

function categorizeRecommendation(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes("performance") ||
    lower.includes("optimize") ||
    lower.includes("cache") ||
    lower.includes("lazy") ||
    lower.includes("bundle")
  )
    return "performance";
  if (
    lower.includes("security") ||
    lower.includes("auth") ||
    lower.includes("sanitiz") ||
    lower.includes("xss") ||
    lower.includes("csrf")
  )
    return "security";
  if (
    lower.includes("test") ||
    lower.includes("coverage") ||
    lower.includes("spec") ||
    lower.includes("jest") ||
    lower.includes("vitest")
  )
    return "testing";
  if (
    lower.includes("document") ||
    lower.includes("readme") ||
    lower.includes("comment") ||
    lower.includes("jsdoc")
  )
    return "documentation";
  if (
    lower.includes("accessib") ||
    lower.includes("aria") ||
    lower.includes("a11y") ||
    lower.includes("screen reader")
  )
    return "accessibility";
  if (
    lower.includes("structure") ||
    lower.includes("refactor") ||
    lower.includes("organiz") ||
    lower.includes("architect") ||
    lower.includes("modular")
  )
    return "structure";
  if (
    lower.includes("ux") ||
    lower.includes("ui") ||
    lower.includes("design") ||
    lower.includes("responsive") ||
    lower.includes("layout")
  )
    return "ux";
  return "general";
}

export async function sendTeamRecommendations(
  channelId: string,
  teamName: string,
  recommendations: string[],
  score: number,
): Promise<void> {
  try {
    if (recommendations.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `💡 Recommendations for ${teamName}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Current score: *${score} pts* — Here are some suggestions to improve:`,
        },
      },
      { type: "divider" },
    ];

    recommendations.forEach((rec, i) => {
      const category = categorizeRecommendation(rec);
      const emoji = CATEGORY_EMOJI[category] ?? "💡";
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${i + 1}.* ${emoji} ${rec}`,
        },
      });
    });

    blocks.push(
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🤖 Generated by AI analysis at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
          },
        ],
      },
    );

    await slack.chat.postMessage({
      channel: channelId,
      blocks,
      text: `💡 ${recommendations.length} recommendations for ${teamName} (Score: ${score} pts)`,
    });
  } catch (error) {
    console.error("Failed to send team recommendations to Slack:", error);
  }
}

// ─── Per-team: Analysis progress ────────────────────────────────────────────

export async function sendTeamAnalysisProgress(
  channelId: string,
  _teamName: string,
  status: "started" | "completed" | "failed",
  opts?: {
    commitSha?: string;
  },
): Promise<void> {
  try {
    const commitSha = opts?.commitSha;
    const hashPart = commitSha ? ` (#${commitSha.slice(0, 7)})` : "";

    const statusConfig = {
      started: { emoji: "🔄", text: "Analysis started" },
      completed: { emoji: "✅", text: "Analysis completed" },
      failed: { emoji: "❌", text: "Analysis failed" },
    };

    const config = statusConfig[status];
    const messageText = `${config.emoji} ${config.text}${hashPart}`;

    await slack.chat.postMessage({
      channel: channelId,
      text: messageText,
    });
  } catch (error) {
    console.error("Failed to send team analysis progress to Slack:", error);
  }
}
