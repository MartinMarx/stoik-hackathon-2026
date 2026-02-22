export const config = {
  model: "claude-opus-4-6",
  max_tokens: 32_768,
  temperature: 0,
  tool_choice: { type: "tool" as const, name: "code_review" },
};
