import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  real,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Teams ───────────────────────────────────────────────────────────────────

export type TeamMemberName = { firstName: string; lastName: string };

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").unique().notNull(),
  repoUrl: text("repo_url").notNull(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  slackChannelId: text("slack_channel_id"),
  appUrl: text("app_url"),
  anthropicApiKey: text("anthropic_api_key"),
  railwayToken: text("railway_token"),
  envContent: text("env_content"),
  memberNames: jsonb("member_names")
    .$type<TeamMemberName[]>()
    .notNull()
    .default([]),
  frozenCommitSha: text("frozen_commit_sha"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Features ────────────────────────────────────────────────────────────────

export const features = pgTable("features", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  criteria: jsonb("criteria").$type<string[]>().notNull(),
  points: integer("points").notNull(),
  difficulty: text("difficulty").notNull(), // easy | medium | hard
  status: text("status").notNull().default("draft"), // draft | announced | archived
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  announcedAt: timestamp("announced_at", { withTimezone: true }),
  announcedBy: text("announced_by"),
});

// ─── Analyses ────────────────────────────────────────────────────────────────

export const analyses = pgTable("analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .references(() => teams.id)
    .notNull(),
  triggeredBy: text("triggered_by").notNull(), // webhook | manual
  commitSha: text("commit_sha").notNull(),
  status: text("status").notNull().default("pending"), // pending | running | completed | failed | cancelled
  result: jsonb("result"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Cursor Metrics ──────────────────────────────────────────────────────────

export const cursorMetrics = pgTable("cursor_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .references(() => teams.id)
    .notNull(),
  analysisId: uuid("analysis_id")
    .references(() => analyses.id)
    .notNull(),
  totalPrompts: integer("total_prompts").notNull().default(0),
  totalToolUses: integer("total_tool_uses").notNull().default(0),
  toolUseBreakdown: jsonb("tool_use_breakdown")
    .$type<Record<string, number>>()
    .notNull()
    .default({}),
  totalSessions: integer("total_sessions").notNull().default(0),
  modelsUsed: text("models_used").array().notNull().default([]),
  agentThoughtsCount: integer("agent_thoughts_count").notNull().default(0),
  fileEditsCount: integer("file_edits_count").notNull().default(0),
  shellExecutionsCount: integer("shell_executions_count").notNull().default(0),
  mcpExecutionsCount: integer("mcp_executions_count").notNull().default(0),
  avgResponseTimeMs: real("avg_response_time_ms").notNull().default(0),
  totalEvents: integer("total_events").notNull().default(0),
  firstEventAt: timestamp("first_event_at", { withTimezone: true }),
  lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  rawStats: jsonb("raw_stats"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Custom achievement definitions (admin-created, awarded manually) ────────

export const customAchievementDefinitions = pgTable(
  "custom_achievement_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    rarity: text("rarity").notNull(),
    category: text("category").notNull(),
    points: integer("points"),
    notifySlack: boolean("notify_slack").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

// ─── Achievements ────────────────────────────────────────────────────────────

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .references(() => teams.id)
    .notNull(),
  achievementId: text("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  data: jsonb("data"),
  notified: boolean("notified").notNull().default(false),
});

// ─── Events ──────────────────────────────────────────────────────────────────

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .references(() => teams.id)
    .notNull(),
  type: text("type").notNull(), // commit | achievement | feature_completed | analysis | score_change
  data: jsonb("data").notNull().default({}),
  points: integer("points"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Scores ──────────────────────────────────────────────────────────────────

export const scores = pgTable("scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .references(() => teams.id)
    .notNull(),
  breakdown: jsonb("breakdown").notNull(),
  total: integer("total").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Votes (demo voting: voterTeamId → votedForTeamId) ────────────────────────

export const votes = pgTable("votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  voterTeamId: uuid("voter_team_id")
    .references(() => teams.id)
    .notNull(),
  votedForTeamId: uuid("voted_for_team_id")
    .references(() => teams.id)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const votePhase = pgTable("vote_phase", {
  id: integer("id").primaryKey().default(1),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const systemConfig = pgTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Feature Completions ─────────────────────────────────────────────────────

export const featureCompletions = pgTable(
  "feature_completions",
  {
    teamId: uuid("team_id")
      .references(() => teams.id)
      .notNull(),
    featureId: uuid("feature_id")
      .references(() => features.id)
      .notNull(),
    status: text("status").notNull().default("missing"), // missing | partial | implemented
    confidence: real("confidence").notNull().default(0),
    details: text("details"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.featureId] }),
  }),
);
