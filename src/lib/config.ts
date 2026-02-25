import { db } from "@/lib/db";
import { systemConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const CONFIG_KEYS = {
  MCP_PAUSED: "mcp_paused",
  GITHUB_WEBHOOKS_PAUSED: "github_webhooks_paused",
  HACKATHON_ENDED: "hackathon_ended",
} as const;

export async function getConfigBool(key: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, key))
    .limit(1);
  return row?.value === "true";
}

export async function setConfigBool(
  key: string,
  value: boolean,
): Promise<void> {
  const val = value ? "true" : "false";
  await db
    .insert(systemConfig)
    .values({ key, value: val })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: val },
    });
}
