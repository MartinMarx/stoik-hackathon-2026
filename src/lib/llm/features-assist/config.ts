import type Anthropic from "@anthropic-ai/sdk";

export const config = {
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 1500,
  temperature: 0,
  tool_choice: { type: "tool" as const, name: "feature_suggestion" },
};

export const tool: Anthropic.Tool = {
  name: "feature_suggestion",
  description:
    "Structured output for a complete hackathon feature with title, description, criteria, points, and difficulty.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestedTitle: {
        type: "string",
        description:
          "Short title (rule-style). A few words, clear and catchy, like game rule titles: e.g. 'Create/join a lobby with 3-5 players', 'Any player can call an Emergency Review'.",
      },
      polishedDescription: {
        type: "string",
        description:
          "One short sentence (max 20 words). Address the team directly — use 'you' / 'your'. Example: 'Give players a way to create or join a session.' Vague hint only; no implementation details. Must be brief.",
      },
      criteria: {
        type: "array",
        items: { type: "string" },
        description:
          "Exactly 3 acceptance criteria. Each a short sentence (a few words), same style as game rules: e.g. 'UI or flow to create a new game lobby', 'Roles not visible to other players'. Concise and verifiable.",
      },
      suggestedPoints: {
        type: "number",
        description:
          "Point value between 5 and 25. 5-8 for easy, 10-15 for medium, 18-25 for hard.",
      },
      suggestedDifficulty: {
        type: "string",
        enum: ["easy", "medium", "hard"],
        description:
          "Difficulty based on implementation effort for a team using AI-assisted coding (Cursor)",
      },
    },
    required: [
      "suggestedTitle",
      "polishedDescription",
      "criteria",
      "suggestedPoints",
      "suggestedDifficulty",
    ],
  },
};
