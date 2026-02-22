export const config = {
  model: "claude-haiku-4-5",
  max_tokens: 32_768,
  temperature: 0,
  tool_choice: { type: "tool" as const, name: "feature_compliance" },
};
