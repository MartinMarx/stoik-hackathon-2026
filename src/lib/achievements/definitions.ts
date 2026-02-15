import { AchievementRarity, AchievementCategory, AchievementDefinition } from "@/types";

export const RARITY_POINTS: Record<AchievementRarity, number> = {
  common: 1, rare: 2, epic: 4, legendary: 6,
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // Implementation (5)
  { id: "first-blood", name: "First Blood", description: "First game rule implemented", icon: "🩸", rarity: "common", category: "implementation" },
  { id: "game-on", name: "Game On", description: "Playable game (lobby + roles + vote)", icon: "🎮", rarity: "rare", category: "implementation" },
  { id: "full-house", name: "Full House", description: "All base rules implemented", icon: "🏠", rarity: "epic", category: "implementation" },
  { id: "beyond-rules", name: "Beyond the Rules", description: "3+ bonus features implemented", icon: "🚀", rarity: "epic", category: "implementation" },
  { id: "masterpiece", name: "Masterpiece", description: "Implementation score > 30/35", icon: "🏆", rarity: "legendary", category: "implementation" },

  // Git - Commits multi-level (4)
  { id: "active", name: "Active", description: "20+ commits", icon: "📝", rarity: "common", category: "git" },
  { id: "commit-machine", name: "Commit Machine", description: "60+ commits", icon: "⚡", rarity: "rare", category: "git" },
  { id: "git-maniac", name: "Git Maniac", description: "120+ commits", icon: "🔥", rarity: "epic", category: "git" },
  { id: "commit-legend", name: "Commit Legend", description: "200+ commits", icon: "👑", rarity: "legendary", category: "git" },

  // Git - Other (8)
  { id: "night-owl", name: "Night Owl", description: "3+ commits between 10 PM and 6 AM", icon: "🦉", rarity: "rare", category: "git" },
  { id: "clean-history", name: "Clean History", description: "No 'fix typo/wip/oops' in commit messages", icon: "🧹", rarity: "rare", category: "git" },
  { id: "refactor-king", name: "Refactor King", description: "300+ lines deleted in a single commit", icon: "♻️", rarity: "rare", category: "git" },
  { id: "atomic-habits", name: "Atomic Habits", description: "20+ commits under 50 lines each", icon: "⚛️", rarity: "epic", category: "git" },
  { id: "big-bang", name: "Big Bang", description: "1000+ lines modified in a single commit", icon: "💥", rarity: "rare", category: "git" },
  { id: "poet", name: "Poet", description: "All commit messages contain an emoji", icon: "🎭", rarity: "common", category: "git" },
  { id: "shakespeare", name: "Shakespeare", description: "Longest meaningful commit message (>200 chars)", icon: "📜", rarity: "epic", category: "git" },
  { id: "marathon-runner", name: "Marathon Runner", description: "Commits over 4+ consecutive hours", icon: "🏃", rarity: "epic", category: "git" },

  // Agentic - Rules multi-level (3)
  { id: "rule-apprentice", name: "Rule Apprentice", description: "3+ custom rules", icon: "📏", rarity: "common", category: "agentic" },
  { id: "rule-master", name: "Rule Master", description: "6+ custom rules", icon: "📐", rarity: "rare", category: "agentic" },
  { id: "rule-overlord", name: "Rule Overlord", description: "10+ custom rules", icon: "👁️", rarity: "epic", category: "agentic" },

  // Agentic - Skills multi-level (3)
  { id: "skill-novice", name: "Skill Novice", description: "2+ custom skills", icon: "🎯", rarity: "common", category: "agentic" },
  { id: "skill-master", name: "Skill Master", description: "5+ custom skills", icon: "🎪", rarity: "rare", category: "agentic" },
  { id: "skill-architect", name: "Skill Architect", description: "8+ custom skills", icon: "🏗️", rarity: "epic", category: "agentic" },

  // Agentic - Commands multi-level (3)
  { id: "commander", name: "Commander", description: "2+ custom commands", icon: "⌨️", rarity: "common", category: "agentic" },
  { id: "command-center", name: "Command Center", description: "4+ custom commands", icon: "🎛️", rarity: "rare", category: "agentic" },
  { id: "automation-king", name: "Automation King", description: "7+ custom commands", icon: "🤴", rarity: "epic", category: "agentic" },

  // Agentic - Other (2)
  { id: "prompt-architect", name: "Prompt Architect", description: "10+ rules + 8+ skills + 7+ commands", icon: "🧠", rarity: "legendary", category: "agentic" },
  { id: "prompt-engineer", name: "Prompt Engineer", description: "Skill with 500+ character instructions", icon: "✍️", rarity: "epic", category: "agentic" },

  // Cursor Usage - Events multi-level (3)
  { id: "cursor-user", name: "Cursor User", description: "100+ events in events.jsonl", icon: "🖱️", rarity: "common", category: "cursor-usage" },
  { id: "cursor-enthusiast", name: "Cursor Enthusiast", description: "500+ events in events.jsonl", icon: "💻", rarity: "rare", category: "cursor-usage" },
  { id: "cursor-addict", name: "Cursor Addict", description: "1500+ events in events.jsonl", icon: "🤯", rarity: "epic", category: "cursor-usage" },

  // Cursor Usage - Prompts multi-level (3)
  { id: "chatterbox", name: "Chatterbox", description: "50+ prompts sent", icon: "💬", rarity: "common", category: "cursor-usage" },
  { id: "prompt-hacker", name: "Prompt Hacker", description: "150+ prompts sent", icon: "🔓", rarity: "rare", category: "cursor-usage" },
  { id: "ai-whisperer", name: "AI Whisperer", description: "300+ prompts sent", icon: "🤫", rarity: "epic", category: "cursor-usage" },

  // Cursor Usage - Other (5)
  { id: "tool-collector", name: "Tool Collector", description: "5+ different tool use types", icon: "🧰", rarity: "rare", category: "cursor-usage" },
  { id: "mcp-explorer", name: "MCP Explorer", description: "MCP usage detected", icon: "🔌", rarity: "epic", category: "cursor-usage" },
  { id: "speed-coder", name: "Speed Coder", description: "10+ file edits in <5 minutes", icon: "⚡", rarity: "rare", category: "cursor-usage" },
  { id: "tab-master", name: "Tab Master", description: "Tab completions used", icon: "↹", rarity: "common", category: "cursor-usage" },
  { id: "multi-model", name: "Multi-Model", description: "2+ different models used", icon: "🔄", rarity: "rare", category: "cursor-usage" },

  // Code Quality (4)
  { id: "typescript-purist", name: "TypeScript Purist", description: "No 'any' in codebase", icon: "💎", rarity: "rare", category: "code-quality" },
  { id: "test-architect", name: "Test Architect", description: "10+ test scenarios written", icon: "🧪", rarity: "epic", category: "code-quality" },
  { id: "doc-writer", name: "Doc Writer", description: "Documentation / JSDoc present", icon: "📚", rarity: "rare", category: "code-quality" },
  { id: "zero-bug", name: "Zero Bug", description: "No bugs detected by AI analysis", icon: "🛡️", rarity: "legendary", category: "code-quality" },

  // Design / UX (5)
  { id: "pixel-perfect", name: "Pixel Perfect", description: "Animation library detected", icon: "✨", rarity: "rare", category: "design" },
  { id: "dark-side", name: "Dark Side", description: "Dark/light theme implemented", icon: "🌙", rarity: "rare", category: "design" },
  { id: "responsive-hero", name: "Responsive Hero", description: "Responsive layout detected", icon: "📱", rarity: "epic", category: "design" },
  { id: "accessible", name: "Accessible", description: "ARIA attributes / a11y labels detected", icon: "♿", rarity: "epic", category: "design" },
  { id: "eye-candy", name: "Eye Candy", description: "High aesthetic score (evaluated by Claude)", icon: "🍬", rarity: "legendary", category: "design" },

  // Collaboration (1)
  { id: "full-squad", name: "Full Squad", description: "4+ active contributors (3+ commits each)", icon: "🤝", rarity: "epic", category: "collaboration" },

  // Speed (3)
  { id: "quick-start", name: "Quick Start", description: "First commit < 15 min after start", icon: "🏁", rarity: "common", category: "speed" },
  { id: "speed-runner", name: "Speed Runner", description: "Feature complete in < 1h", icon: "⏱️", rarity: "rare", category: "speed" },
  { id: "first-to-ship", name: "First to Ship", description: "First team with a functional game", icon: "🥇", rarity: "legendary", category: "speed" },

  // Features (2)
  { id: "feature-hunter", name: "Feature Hunter", description: "Most bonus features implemented (relative)", icon: "🎯", rarity: "epic", category: "features" },
  { id: "point-machine", name: "Point Machine", description: "Highest total bonus feature points (relative)", icon: "💰", rarity: "legendary", category: "features" },

  // Fun / Easter Eggs (9)
  { id: "copy-pasta", name: "Copy-Pasta", description: "A file with 500+ lines", icon: "🍝", rarity: "common", category: "fun" },
  { id: "overkill", name: "Overkill", description: "30+ npm dependencies added", icon: "📦", rarity: "rare", category: "fun" },
  { id: "minimalist", name: "Minimalist", description: "< 5 npm dependencies added", icon: "🧘", rarity: "rare", category: "fun" },
  { id: "readme-warrior", name: "README Warrior", description: "README.md > 1000 characters", icon: "📖", rarity: "common", category: "fun" },
  { id: "git-flow", name: "Git Flow", description: "3+ branches in repo", icon: "🌿", rarity: "rare", category: "fun" },
  { id: "one-prompt-wonder", name: "One-Prompt Wonder", description: "500+ line commit followed by no fix for 30 min", icon: "🎩", rarity: "legendary", category: "fun" },
  { id: "perfectionist", name: "Perfectionist", description: "5+ fix/refactor commits after first big commit", icon: "🔍", rarity: "epic", category: "fun" },
  { id: "conference-call", name: "Conference Call", description: "3+ simultaneous Cursor sessions detected", icon: "📞", rarity: "rare", category: "fun" },
  { id: "easter-egg-hunter", name: "Easter Egg Hunter", description: "Found a hidden easter egg (manual award)", icon: "🥚", rarity: "legendary", category: "fun" },
];

export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}
