import { WebClient } from "@slack/web-api";
import type { Block, KnownBlock } from "@slack/types";
import type {
  HackathonFeature,
  LeaderboardEntry,
  AchievementDefinition,
  AchievementRarity,
  TeamMemberName,
} from "@/types";
import { getConfigBool, CONFIG_KEYS } from "@/lib/config";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const channel = process.env.SLACK_CHANNEL_ID!;

async function isHackathonEnded() {
  return getConfigBool(CONFIG_KEYS.HACKATHON_ENDED);
}

const RARITY_EMOJI: Record<AchievementRarity, string> = {
  common: "⬜",
  rare: "🟦",
  epic: "🟪",
  legendary: "🟨",
};

function rarityLabel(r: AchievementRarity): string {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function achievementTitle(teamName: string, count: number): string {
  return count === 1
    ? `${teamName} — 1 achievement unlocked`
    : `${teamName} — ${count} achievements unlocked`;
}

function formatMemberNames(memberNames: TeamMemberName[]): string {
  return memberNames
    .map((m) => `${m.firstName} ${m.lastName}`.trim())
    .filter(Boolean)
    .join(", ");
}

function buildAchievementBlocks(
  teamName: string,
  achievements: AchievementDefinition[],
  memberNames?: TeamMemberName[],
): (Block | KnownBlock)[] {
  const blocks: (Block | KnownBlock)[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: achievementTitle(teamName, achievements.length),
        emoji: false,
      },
    },
  ];
  if (memberNames?.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `_${formatMemberNames(memberNames)}_`,
      },
    });
  }
  for (const a of achievements) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${a.icon} *${a.name}* _${rarityLabel(a.rarity)}_\n${a.description}`,
      },
    });
  }

  return blocks;
}

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
  return `${"█".repeat(filled)}${"░".repeat(empty)} ${current}`;
}

export async function announceFeature(
  feature: HackathonFeature,
): Promise<void> {
  try {
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

export async function sendPublicAchievements(
  teamName: string,
  achievements: AchievementDefinition[],
  memberNames?: TeamMemberName[],
): Promise<void> {
  if (achievements.length === 0) return;
  try {
    const blocks = buildAchievementBlocks(teamName, achievements, memberNames);
    const title = achievementTitle(teamName, achievements.length);
    const playerPart = memberNames?.length
      ? ` — ${formatMemberNames(memberNames)}`
      : "";
    const names = achievements.map((a) => a.name).join(", ");
    await slack.chat.postMessage({
      channel,
      blocks,
      text: `${title}${playerPart}: ${names}`,
    });
  } catch (error) {
    console.error("Failed to send public achievements to Slack:", error);
  }
}

export async function sendPublicScoreUpdate(
  teamName: string,
  previousScore: number | null,
  newScore: number,
  maxScore: number,
  achievementBonus = 0,
): Promise<void> {
  try {
    const featureScore = newScore - achievementBonus;
    const prevFeatureScore =
      previousScore != null ? previousScore - achievementBonus : null;
    const progressBar = buildProgressBar(featureScore, maxScore);
    const achievementPart =
      achievementBonus > 0 ? ` (+${achievementBonus} from achievements)` : "";
    const delta =
      prevFeatureScore != null ? featureScore - prevFeatureScore : null;
    const deltaPart =
      delta !== null && delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : "";
    const scoreLine =
      previousScore != null
        ? `*${teamName}* — ${prevFeatureScore} → ${featureScore} pts${achievementPart}${deltaPart}`
        : `*${teamName}* — First score: ${featureScore} pts${achievementPart}`;

    const blocks: (Block | KnownBlock)[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "Score update", emoji: false },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${scoreLine}\n\`${progressBar}\``,
        },
      },
    ];
    const fallbackText =
      previousScore != null
        ? `${teamName} — Score: ${previousScore} → ${newScore}${deltaPart}`
        : `${teamName} — Score: — → ${newScore}`;
    await slack.chat.postMessage({
      channel,
      blocks,
      text: fallbackText,
    });
  } catch (error) {
    console.error("Failed to send public score update to Slack:", error);
  }
}

export async function sendPrivateAchievements(
  channelId: string,
  teamName: string,
  achievements: AchievementDefinition[],
): Promise<void> {
  if (achievements.length === 0) return;
  if (await isHackathonEnded()) return;
  try {
    const blocks = buildAchievementBlocks(teamName, achievements);
    const title = achievementTitle(teamName, achievements.length);
    const names = achievements.map((a) => a.name).join(", ");
    await slack.chat.postMessage({
      channel: channelId,
      blocks,
      text: `${title}: ${names}`,
    });
  } catch (error) {
    console.error("Failed to send private achievements to Slack:", error);
  }
}

export async function sendLeaderboard(
  entries: LeaderboardEntry[],
): Promise<void> {
  try {
    const RANK_MEDALS: Record<number, string> = {
      1: "🥇",
      2: "🥈",
      3: "🥉",
    };

    const maxScore =
      entries.length > 0 ? Math.ceil(entries[0].totalScore * 1.2) : 1;

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
      const progressBar = buildProgressBar(entry.totalScore, maxScore);

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${rankDisplay} *${entry.team}* — ${entry.totalScore}\n\`${progressBar}\``,
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

// ─── Welcome message (new team) ───────────────────────────────────────────────

function getPublicBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function repoUrlsPair(repoUrl: string): { https: string; ssh: string } {
  const u = repoUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
  const httpsMatch = u.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/);
  if (httpsMatch) {
    const path = httpsMatch[1];
    return {
      https: `https://github.com/${path}`,
      ssh: `git@github.com:${path}.git`,
    };
  }
  const sshMatch = u.match(/^git@github\.com:([^/]+\/[^/]+)/);
  if (sshMatch) {
    const path = sshMatch[1];
    return {
      https: `https://github.com/${path}`,
      ssh: `git@github.com:${path}.git`,
    };
  }
  return { https: repoUrl, ssh: repoUrl };
}

export async function sendWelcomeMessage(
  channelId: string,
  teamName: string,
  repoUrl: string,
  opts?: { teamId?: string; appUrl?: string | null },
): Promise<void> {
  const { https: httpsUrl, ssh: sshUrl } = repoUrlsPair(repoUrl);
  const baseUrl = getPublicBaseUrl();
  const publicTeamUrl = opts?.teamId
    ? `${baseUrl}/public/teams/${opts.teamId}`
    : null;

  const elements: Array<{
    type: "button";
    text: { type: "plain_text"; text: string; emoji?: boolean };
    url: string;
  }> = [
    {
      type: "button",
      text: { type: "plain_text", text: ":github: Repository", emoji: true },
      url: httpsUrl,
    },
  ];
  if (publicTeamUrl) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "📊 Public team page", emoji: true },
      url: publicTeamUrl,
    });
  }
  if (opts?.appUrl?.trim()) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "🌐 App URL", emoji: true },
      url: opts.appUrl.trim(),
    });
  }

  const blocks: (Block | KnownBlock)[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Welcome, ${teamName}!`, emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "This is your team’s private channel for the hackathon. Here’s a quick overview and how to get started.",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*The game (DesignMafia)*\nDesignMafia is like Among Us in a Figma-like editor: *crewmates* complete tasks and try to find the *saboteur*; the *saboteur* secretly introduces regressions. Matches last 5 minutes, with a progress bar and voting. Crewmates win by filling the bar or ejecting the saboteur; the saboteur wins by surviving or meeting sabotage goals.",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*What happens during the hackathon*\n" +
          "• New features will be announced on Slack, and the leaderboard will be sent regularly.\n" +
          "• Achievements can be unlocked throughout the hackathon. They stay hidden until unlocked and are shared between teams on Slack.\n" +
          "• Analysis runs automatically on every push to your repository.\n" +
          "• At the end, every team demos its app and everyone votes for their favorite team.",
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "*Quickstart*\n\n*1. Get the repo*\n" +
          "• *HTTP (HTTPS):*\n```\ngit clone " +
          httpsUrl +
          "\n```\n• *SSH:*\n```\ngit clone " +
          sshUrl +
          "\n```\n• *Or in Cursor:* *File → Clone Git Repository...* and paste either URL below.\n\n*2. Run setup (everyone)*\nOpen the project in Cursor, then run the */setup* command in the Cursor agent to configure the project.",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Repo URL (HTTP):* ${httpsUrl}\n*Repo URL (SSH):* ${sshUrl}`,
      },
    },
    {
      type: "actions",
      elements,
    },
  ];
  const text = `Welcome, ${teamName}! Clone the repo (${httpsUrl} or ${sshUrl}), open it in Cursor, and run /setup.`;
  try {
    await slack.chat.postMessage({
      channel: channelId,
      text,
      blocks,
    });
  } catch (error) {
    console.error(
      `Failed to send welcome message to channel ${channelId}:`,
      error,
    );
    throw error;
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
  if (await isHackathonEnded()) return;
  try {
    const top = recommendations.slice(0, 5);
    if (top.length === 0) return;

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

    top.forEach((rec, i) => {
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
      text: `💡 ${top.length} recommendations for ${teamName} (Score: ${score} pts)`,
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
    repoOwner?: string;
    repoName?: string;
    totalScore?: number;
    previousScore?: number | null;
    achievementBonus?: number;
    teamId?: string;
    scoreChangeSummary?: string;
  },
): Promise<void> {
  if (await isHackathonEnded()) return;
  try {
    const commitSha = opts?.commitSha;
    const repoOwner = opts?.repoOwner;
    const repoName = opts?.repoName;
    const totalScore = opts?.totalScore;
    const previousScore = opts?.previousScore ?? null;
    const achievementBonus = opts?.achievementBonus ?? 0;
    const teamId = opts?.teamId;
    const scoreChangeSummary = opts?.scoreChangeSummary;
    const shortHash = commitSha?.slice(0, 7);
    const commitUrl =
      commitSha && repoOwner && repoName
        ? `https://github.com/${repoOwner}/${repoName}/commit/${commitSha}`
        : null;
    const hashPart = commitUrl
      ? ` (<${commitUrl}|#${shortHash}>)`
      : commitSha
        ? ` (#${shortHash})`
        : "";

    const statusConfig = {
      started: { emoji: "🔄", text: "Analysis started" },
      completed: { emoji: "✅", text: "Analysis completed" },
      failed: { emoji: "❌", text: "Analysis failed" },
    };

    const config = statusConfig[status];
    let messageText = `${config.emoji} ${config.text}${hashPart}`;
    if (status === "completed" && totalScore != null) {
      const featureScore = totalScore - achievementBonus;
      const prevFeatureScore =
        previousScore != null ? previousScore - achievementBonus : null;
      const delta =
        prevFeatureScore != null ? featureScore - prevFeatureScore : null;
      const deltaSuffix =
        delta !== null && delta !== 0
          ? ` (${delta > 0 ? "+" : ""}${delta})`
          : "";
      const achievementPart =
        achievementBonus > 0 ? ` (+${achievementBonus} from achievements)` : "";
      const scorePart =
        prevFeatureScore != null
          ? ` — Score: ${prevFeatureScore} → ${featureScore}${achievementPart}${deltaSuffix}`
          : ` — Score: ${featureScore}${achievementPart}`;
      messageText += scorePart;
    }

    const basePayload = { channel: channelId, text: messageText };

    if (status === "completed" && teamId) {
      const publicUrl = `${getPublicBaseUrl()}/public/teams/${teamId}`;
      const blocks: {
        type: string;
        text?: { type: string; text: string };
        elements?: unknown[];
      }[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: messageText,
          },
        },
      ];
      if (scoreChangeSummary) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `_${scoreChangeSummary}_`,
          },
        });
      }
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View team page",
              emoji: true,
            },
            url: publicUrl,
            action_id: "view_team_public",
          },
        ],
      });
      await slack.chat.postMessage({
        ...basePayload,
        blocks,
      });
    } else {
      await slack.chat.postMessage(basePayload);
    }
  } catch (error) {
    console.error("Failed to send team analysis progress to Slack:", error);
  }
}
