export function getConfig(isLargeDiff: boolean) {
  return {
    model: "claude-sonnet-4-6",
    max_tokens: 32_768,
    temperature: 0,
    tool_choice: isLargeDiff
      ? ({ type: "auto" } as const)
      : { type: "tool" as const, name: "code_review" },
  };
}
