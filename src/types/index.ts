export type AchievementRarity = "common" | "rare" | "epic" | "legendary";
export type AchievementCategory =
  | "implementation"
  | "git"
  | "agentic"
  | "cursor-usage"
  | "code-quality"
  | "design"
  | "collaboration"
  | "speed"
  | "features"
  | "fun"
  | "custom";

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: AchievementRarity;
  category: AchievementCategory;
}

export interface UnlockedAchievement extends AchievementDefinition {
  unlockedAt: string;
  data?: Record<string, unknown>;
}

export interface ScoreBreakdown {
  implementation: {
    total: number;
    rulesComplete: number;
    rulesPartial: number;
    creative: number;
  };
  agentic: { total: number; rules: number; skills: number; commands: number };
  codeQuality: {
    total: number;
    typescript: number;
    tests: number;
    structure: number;
  };
  gitActivity: {
    total: number;
    commits: number;
    contributors: number;
    regularity: number;
  };
  cursorUsage: {
    total: number;
    prompts: number;
    toolDiversity: number;
    sessions: number;
    models: number;
  };
  bonusFeatures?: { total: number; implemented: number; announced: number };
}

export interface AIReviewResult {
  rulesImplemented: {
    rule: string;
    status: "complete" | "partial" | "missing";
    confidence: number;
    details?: string;
  }[];
  codeQualityScore: number;
  bonusFeatures: string[];
  uxScore: number;
  recommendations: string[];
}

export interface CursorStructure {
  rules: { name: string; glob: string; content: string }[];
  skills: { name: string; description: string; contentLength: number }[];
  commands: { name: string; description: string }[];
  hooks: { event: string; command: string }[];
  rulesCount: number;
  skillsCount: number;
  commandsCount: number;
}

export interface CursorMetricsData {
  totalPrompts: number;
  totalToolUses: number;
  toolUseBreakdown: Record<string, number>;
  totalSessions: number;
  modelsUsed: string[];
  agentThoughtsCount: number;
  fileEditsCount: number;
  shellExecutionsCount: number;
  mcpExecutionsCount: number;
  avgResponseTimeMs: number;
  totalEvents: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface GitMetrics {
  commits: GitCommit[];
  totalCommits: number;
  authors: string[];
  additions: number;
  deletions: number;
  filesChanged: string[];
  commitsByHour: Record<number, number>;
  firstCommitAt?: string;
  lastCommitAt?: string;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  email: string;
  date: string;
  additions: number;
  deletions: number;
  files: string[];
}

export interface TeamAnalysis {
  team: string;
  teamId: string;
  analyzedAt: string;
  commitSha: string;
  cursor: CursorStructure;
  cursorMetrics: CursorMetricsData;
  git: GitMetrics;
  aiReview: AIReviewResult;
  featuresCompliance: FeatureComplianceResult[];
  score: ScoreBreakdown;
  totalScore: number;
  achievements: UnlockedAchievement[];
  recommendations: string[];
}

export interface FeatureComplianceResult {
  featureId: string;
  featureTitle: string;
  status: "implemented" | "partial" | "missing";
  confidence: number;
  details?: string;
}

export interface LeaderboardEntry {
  rank: number;
  team: string;
  teamId: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  achievements: UnlockedAchievement[];
  trend: "up" | "down" | "stable";
  previousRank?: number;
}

export interface HackathonFeature {
  id: string;
  title: string;
  description: string;
  criteria: string[];
  points: number;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "announced" | "archived";
  createdAt: string;
  announcedAt?: string;
  announcedBy?: string;
}

export interface TimelineEvent {
  id: string;
  teamId: string;
  teamName: string;
  type:
    | "commit"
    | "achievement"
    | "feature_completed"
    | "analysis"
    | "score_change";
  data: Record<string, unknown>;
  points: number | null;
  createdAt: string;
}

export interface VoteTeam {
  teamId: string;
  name: string;
  autoScore: number;
  voteCount: number;
}

export interface VotesResponse {
  teams: VoteTeam[];
  totalTeams: number;
  votedCount: number;
  allVoted: boolean;
  voteEnded: boolean;
}
