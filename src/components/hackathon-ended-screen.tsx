import { getConfigBool, CONFIG_KEYS } from "@/lib/config";

export async function HackathonGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const ended = await getConfigBool(CONFIG_KEYS.HACKATHON_ENDED);

  if (ended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <p className="text-6xl">🏁</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Hackathon is over!
          </h1>
          <p className="text-muted-foreground max-w-sm">
            Thanks for participating. This page is no longer available.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
