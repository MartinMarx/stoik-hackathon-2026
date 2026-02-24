import {
  AchievementRarity,
  AchievementCategory,
  AchievementDefinition,
} from "@/types";

export const RARITY_POINTS: Record<AchievementRarity, number> = {
  common: 1,
  rare: 2,
  epic: 4,
  legendary: 6,
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Implementation (5)
  {
    id: "first-blood",
    name: "First Blood",
    description: "First game rule implemented",
    icon: "🩸",
    rarity: "common",
    category: "implementation",
  },
  {
    id: "game-on",
    name: "Game On",
    description: "Playable game (lobby + roles + vote)",
    icon: "🎮",
    rarity: "rare",
    category: "implementation",
  },
  {
    id: "full-house",
    name: "Full House",
    description: "All base rules implemented",
    icon: "🏠",
    rarity: "epic",
    category: "implementation",
  },
  {
    id: "beyond-rules",
    name: "Beyond the Rules",
    description: "3+ bonus features implemented",
    icon: "🚀",
    rarity: "epic",
    category: "implementation",
  },
  {
    id: "masterpiece",
    name: "Masterpiece",
    description: "Implementation score > 34/40",
    icon: "🏆",
    rarity: "legendary",
    category: "implementation",
  },

  // Git - Commits multi-level (4)
  {
    id: "active",
    name: "Active",
    description: "40+ commits",
    icon: "📝",
    rarity: "common",
    category: "git",
  },
  {
    id: "commit-machine",
    name: "Commit Machine",
    description: "100+ commits",
    icon: "⚡",
    rarity: "rare",
    category: "git",
  },
  {
    id: "git-maniac",
    name: "Git Maniac",
    description: "200+ commits",
    icon: "🔥",
    rarity: "epic",
    category: "git",
  },
  {
    id: "commit-legend",
    name: "Commit Legend",
    description: "350+ commits",
    icon: "👑",
    rarity: "legendary",
    category: "git",
  },

  // Git - Branches multi-level (4)
  {
    id: "branching-out",
    name: "Branching Out",
    description: "10+ branches",
    icon: "🌿",
    rarity: "common",
    category: "git",
  },
  {
    id: "branch-manager",
    name: "Branch Manager",
    description: "25+ branches",
    icon: "🌳",
    rarity: "rare",
    category: "git",
  },
  {
    id: "branch-overlord",
    name: "Branch Overlord",
    description: "50+ branches",
    icon: "🌲",
    rarity: "epic",
    category: "git",
  },
  {
    id: "branch-galaxy",
    name: "Branch Galaxy",
    description: "75+ branches",
    icon: "🪐",
    rarity: "legendary",
    category: "git",
  },

  // Git - Other (8)
  {
    id: "night-owl",
    name: "Night Owl",
    description: "3+ commits between 10 PM and 6 AM",
    icon: "🦉",
    rarity: "rare",
    category: "git",
  },
  {
    id: "clean-history",
    name: "Clean History",
    description: "10+ commits with no 'fix typo/wip/oops' in messages",
    icon: "🧹",
    rarity: "rare",
    category: "git",
  },
  {
    id: "refactor-king",
    name: "Refactor King",
    description: "300+ lines deleted in a single commit",
    icon: "♻️",
    rarity: "rare",
    category: "git",
  },
  {
    id: "atomic-habits",
    name: "Atomic Habits",
    description: "20+ commits under 50 lines each",
    icon: "⚛️",
    rarity: "epic",
    category: "git",
  },
  {
    id: "big-bang",
    name: "Big Bang",
    description: "3000+ lines modified in a single commit",
    icon: "💥",
    rarity: "rare",
    category: "git",
  },
  {
    id: "poet",
    name: "Poet",
    description: "At least 10 commits contain an emoji",
    icon: "🎭",
    rarity: "common",
    category: "git",
  },
  {
    id: "shakespeare",
    name: "Shakespeare",
    description: "Longest meaningful commit message (500+ chars)",
    icon: "📜",
    rarity: "epic",
    category: "git",
  },
  {
    id: "marathon-runner",
    name: "Marathon Runner",
    description: "Commits over 4+ consecutive hours",
    icon: "🏃",
    rarity: "epic",
    category: "git",
  },

  // Agentic - Rules multi-level (3)
  {
    id: "rule-apprentice",
    name: "Rule Apprentice",
    description: "4+ custom rules",
    icon: "📏",
    rarity: "common",
    category: "git",
  },
  {
    id: "rule-master",
    name: "Rule Master",
    description: "8+ custom rules",
    icon: "📐",
    rarity: "rare",
    category: "git",
  },
  {
    id: "rule-overlord",
    name: "Rule Overlord",
    description: "14+ custom rules",
    icon: "👁️",
    rarity: "epic",
    category: "git",
  },

  // Agentic - Skills multi-level (3)
  {
    id: "skill-novice",
    name: "Skill Novice",
    description: "3+ custom skills",
    icon: "🎯",
    rarity: "common",
    category: "git",
  },
  {
    id: "skill-master",
    name: "Skill Master",
    description: "6+ custom skills",
    icon: "🎪",
    rarity: "rare",
    category: "git",
  },
  {
    id: "skill-architect",
    name: "Skill Architect",
    description: "10+ custom skills",
    icon: "🏗️",
    rarity: "epic",
    category: "git",
  },

  // Agentic - Commands multi-level (3)
  {
    id: "commander",
    name: "Commander",
    description: "3+ custom commands",
    icon: "⌨️",
    rarity: "common",
    category: "git",
  },
  {
    id: "command-center",
    name: "Command Center",
    description: "5+ custom commands",
    icon: "🎛️",
    rarity: "rare",
    category: "git",
  },
  {
    id: "automation-king",
    name: "Automation King",
    description: "9+ custom commands",
    icon: "🤴",
    rarity: "epic",
    category: "git",
  },

  // Agentic - Other (3)
  {
    id: "prompt-architect",
    name: "Prompt Architect",
    description: "14+ rules + 10+ skills + 9+ commands",
    icon: "🧠",
    rarity: "legendary",
    category: "git",
  },
  {
    id: "agentic-maestro",
    name: "Agentic Maestro",
    description:
      "LLM quality score > 8/10 average across rules, skills, commands",
    icon: "🎼",
    rarity: "legendary",
    category: "git",
  },
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    description: "Skill with 500+ character instructions",
    icon: "✍️",
    rarity: "epic",
    category: "git",
  },

  // Cursor Usage - Events multi-level (3)
  {
    id: "cursor-user",
    name: "Cursor User",
    description: "2000+ Cursor events",
    icon: "🖱️",
    rarity: "common",
    category: "git",
  },
  {
    id: "cursor-enthusiast",
    name: "Cursor Enthusiast",
    description: "8000+ Cursor events",
    icon: "💻",
    rarity: "rare",
    category: "git",
  },
  {
    id: "cursor-addict",
    name: "Cursor Addict",
    description: "20000+ Cursor events",
    icon: "🤯",
    rarity: "epic",
    category: "git",
  },

  // Cursor Usage - Prompts multi-level (3)
  {
    id: "chatterbox",
    name: "Chatterbox",
    description: "100+ prompts sent",
    icon: "💬",
    rarity: "common",
    category: "git",
  },
  {
    id: "prompt-hacker",
    name: "Prompt Hacker",
    description: "250+ prompts sent",
    icon: "🔓",
    rarity: "rare",
    category: "git",
  },
  {
    id: "ai-whisperer",
    name: "AI Whisperer",
    description: "500+ prompts sent",
    icon: "🤫",
    rarity: "epic",
    category: "git",
  },

  // Cursor Usage - Other (5)
  {
    id: "tool-collector",
    name: "Tool Collector",
    description: "5+ different tool use types",
    icon: "🧰",
    rarity: "rare",
    category: "git",
  },
  {
    id: "swiss-army-knife",
    name: "Swiss Army Knife",
    description: "8+ different tool types used in Cursor",
    icon: "🔪",
    rarity: "rare",
    category: "git",
  },
  {
    id: "mcp-explorer",
    name: "MCP Explorer",
    description: "3+ MCP servers used",
    icon: "🔌",
    rarity: "epic",
    category: "git",
  },
  {
    id: "mcp-pioneer",
    name: "MCP Pioneer",
    description: "5+ MCP servers configured and 50+ MCP executions",
    icon: "🚀",
    rarity: "legendary",
    category: "git",
  },
  {
    id: "speed-coder",
    name: "Speed Coder",
    description: "10+ file edits in <5 minutes",
    icon: "⚡",
    rarity: "rare",
    category: "git",
  },
  {
    id: "tab-master",
    name: "Tab Master",
    description: "50+ tab completions used",
    icon: "↹",
    rarity: "common",
    category: "git",
  },
  {
    id: "multi-model",
    name: "Multi-Model",
    description: "2+ different models used",
    icon: "🔄",
    rarity: "rare",
    category: "git",
  },
  {
    id: "multi-model-explorer",
    name: "Multi-Model Explorer",
    description: "4+ different models used",
    icon: "🔀",
    rarity: "epic",
    category: "git",
  },
  {
    id: "multi-model-veteran",
    name: "Multi-Model Veteran",
    description: "7+ different models used",
    icon: "🎛️",
    rarity: "legendary",
    category: "git",
  },

  // Code Quality (4)
  {
    id: "typescript-purist",
    name: "TypeScript Purist",
    description: "No 'any' in codebase",
    icon: "💎",
    rarity: "rare",
    category: "code-quality",
  },
  {
    id: "test-architect",
    name: "Test Architect",
    description: "10+ test scenarios written",
    icon: "🧪",
    rarity: "epic",
    category: "code-quality",
  },
  {
    id: "doc-writer",
    name: "Doc Writer",
    description: "Documentation / JSDoc present in 10+ files",
    icon: "📚",
    rarity: "rare",
    category: "code-quality",
  },
  // Design / UX (4)
  {
    id: "pixel-perfect",
    name: "Pixel Perfect",
    description: "Animations used (e.g. framer-motion, etc.)",
    icon: "✨",
    rarity: "rare",
    category: "design",
  },
  {
    id: "dark-side",
    name: "Dark Side",
    description: "Working dark/light theme",
    icon: "🌙",
    rarity: "rare",
    category: "design",
  },
  {
    id: "accessible",
    name: "Accessible",
    description: "ARIA attributes / a11y labels detected",
    icon: "♿",
    rarity: "epic",
    category: "design",
  },
  {
    id: "eye-candy",
    name: "Eye Candy",
    description: "High aesthetic score (evaluated by Claude)",
    icon: "🍬",
    rarity: "legendary",
    category: "design",
  },

  // Collaboration (1)
  {
    id: "full-squad",
    name: "Full Squad",
    description: "4+ active contributors (3+ commits each)",
    icon: "🤝",
    rarity: "epic",
    category: "git",
  },

  // Speed (3)
  {
    id: "quick-start",
    name: "Quick Start",
    description: "First commit < 15 min after start",
    icon: "🏁",
    rarity: "common",
    category: "speed",
  },
  {
    id: "speed-runner",
    name: "Speed Runner",
    description: "Feature complete in < 1h",
    icon: "⏱️",
    rarity: "rare",
    category: "speed",
  },
  {
    id: "first-to-ship",
    name: "First to Ship",
    description: "First team with a functional game",
    icon: "🥇",
    rarity: "legendary",
    category: "speed",
  },

  // Features (2)
  {
    id: "feature-hunter",
    name: "Feature Hunter",
    description: "Most bonus features implemented (relative)",
    icon: "🎯",
    rarity: "epic",
    category: "features",
  },
  {
    id: "point-machine",
    name: "Point Machine",
    description: "Highest total bonus feature points (relative)",
    icon: "💰",
    rarity: "legendary",
    category: "features",
  },

  // Fun / Easter Eggs (9)
  {
    id: "copy-pasta",
    name: "Copy-Pasta",
    description: "A file with 500+ lines",
    icon: "🍝",
    rarity: "common",
    category: "fun",
  },
  {
    id: "overkill",
    name: "Overkill",
    description: "30+ npm dependencies added",
    icon: "📦",
    rarity: "rare",
    category: "fun",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "< 5 npm dependencies added",
    icon: "🧘",
    rarity: "rare",
    category: "fun",
  },
  {
    id: "readme-warrior",
    name: "README Warrior",
    description: "README.md > 1000 characters",
    icon: "📖",
    rarity: "common",
    category: "fun",
  },
  {
    id: "git-flow",
    name: "Git Flow",
    description: "3+ branches in repo",
    icon: "🌿",
    rarity: "rare",
    category: "fun",
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "5+ fix/refactor commits after first big commit",
    icon: "🔍",
    rarity: "epic",
    category: "fun",
  },
  {
    id: "session-starter",
    name: "Session Starter",
    description: "3+ Cursor sessions detected",
    icon: "🪑",
    rarity: "common",
    category: "fun",
  },
  {
    id: "conference-call",
    name: "Conference Call",
    description: "5+ Cursor sessions detected",
    icon: "📞",
    rarity: "rare",
    category: "fun",
  },
  {
    id: "war-room",
    name: "War Room",
    description: "8+ Cursor sessions detected",
    icon: "🫡",
    rarity: "epic",
    category: "fun",
  },
  // Code Quality
  {
    id: "zero-bugs",
    name: "Zero Bugs",
    description: "Code quality score ≥ 18/20",
    icon: "🐛",
    rarity: "epic",
    category: "code-quality",
  },

  // DevOps / CI
  {
    id: "pipeline-builder",
    name: "Pipeline Builder",
    description: "Added CI/DevOps config (e.g. GitHub Actions)",
    icon: "🔄",
    rarity: "rare",
    category: "git",
  },

  // Design - Favicon
  {
    id: "custom-favicon",
    name: "Custom Favicon",
    description: "Custom favicon added to the project",
    icon: "🔖",
    rarity: "common",
    category: "design",
  },

  // Agentic - Reviewer agents
  {
    id: "code-reviewer-agent",
    name: "Code Reviewer Agent",
    description: "Implemented a code reviewer agent in .cursor",
    icon: "🔬",
    rarity: "rare",
    category: "git",
  },
  {
    id: "ui-reviewer-agent",
    name: "UI Reviewer Agent",
    description: "Implemented a UI reviewer agent in .cursor",
    icon: "🎨",
    rarity: "rare",
    category: "git",
  },
];

export function getAchievementById(
  id: string,
): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function getAchievementsByCategory(
  category: AchievementCategory,
): AchievementDefinition[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}
