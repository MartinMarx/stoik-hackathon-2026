export const config = {
  model: "claude-haiku-4-5",
  max_tokens: 2048,
  temperature: 0,
  tool_choice: { type: "tool" as const, name: "agentic_quality_score" },
};
