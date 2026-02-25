import { HackathonGate } from "@/components/hackathon-ended-screen";

export default function AnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HackathonGate>
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </HackathonGate>
  );
}
