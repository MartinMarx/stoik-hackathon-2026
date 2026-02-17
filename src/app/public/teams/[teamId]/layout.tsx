export default function PublicTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
