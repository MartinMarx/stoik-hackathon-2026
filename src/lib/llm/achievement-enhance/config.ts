import type Anthropic from "@anthropic-ai/sdk";

export const config = {
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 500,
  temperature: 0.7,
  tool_choice: { type: "tool" as const, name: "achievement_enhancement" },
};

export const tool: Anthropic.Tool = {
  name: "achievement_enhancement",
  description:
    "Enhanced achievement suggestion with polished name, description, icon, rarity, category, and points.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description:
          "Short punchy achievement name (2-5 words). Fun and memorable.",
      },
      description: {
        type: "string",
        description:
          "One sentence describing what the team did to earn this achievement.",
      },
      icon: {
        type: "string",
        description: "A single emoji that visually represents the achievement.",
      },
      rarity: {
        type: "string",
        enum: ["common", "rare", "epic", "legendary"],
        description: "Achievement rarity based on difficulty/impressiveness.",
      },
      category: {
        type: "string",
        enum: [
          "implementation",
          "git",
          "code-quality",
          "design",
          "speed",
          "features",
          "fun",
        ],
        description: "Best matching achievement category.",
      },
      points: {
        type: "number",
        description:
          "Point value (1-10). common=1, rare=2-3, epic=4-5, legendary=6-10.",
      },
    },
    required: ["name", "description", "icon", "rarity", "category", "points"],
  },
};
