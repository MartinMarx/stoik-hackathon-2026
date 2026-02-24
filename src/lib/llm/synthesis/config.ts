export const config = {
  model: "claude-sonnet-4-5",
  max_tokens: 32_768,
  temperature: 0,
  tool_choice: { type: "tool" as const, name: "code_review" },
};
