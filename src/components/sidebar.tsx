"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  RefreshCw,
  Settings,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CommunicationModal } from "@/components/communication-modal";
import { useAnalysisEventsContext } from "@/components/analysis-provider";

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/features", label: "Features", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { analyzingTeams } = useAnalysisEventsContext();
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch("/api/teams");
        if (!res.ok) throw new Error("Failed to fetch teams");
        const data = await res.json();
        setTeams(Array.isArray(data) ? data : (data.teams ?? []));
      } catch (err) {
        console.error("Failed to load teams:", err);
      }
    }
    fetchTeams();
  }, []);

  async function handleAnalyzeAll() {
    setAnalyzingAll(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      toast.success("Analysis complete", {
        description: data.message ?? "All features analyzed successfully.",
      });
    } catch (err) {
      toast.error("Analysis failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setAnalyzingAll(false);
    }
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <Trophy className="size-5 text-sidebar-primary" />
        <span className="text-sm font-semibold tracking-tight">
          Hackathon Admin
        </span>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}

        <Separator className="my-2" />

        {/* Teams */}
        <p className="px-3 pt-1 pb-1 text-xs font-medium text-muted-foreground">
          Teams
        </p>
        {teams.map((team) => {
          const teamHref = `/teams/${team.id}`;
          const isTeamActive = pathname.startsWith(teamHref);
          const isAnalyzing = analyzingTeams.has(team.id);
          return (
            <Link
              key={team.id}
              href={teamHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isTeamActive &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              )}
            >
              {isAnalyzing ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <Users className="size-4" />
              )}
              {team.name}
            </Link>
          );
        })}

        <Separator className="my-2" />

        <Link
          href="/live"
          target="_blank"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ExternalLink className="size-4" />
          Live View
        </Link>
      </nav>

      {/* Quick actions */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
          Quick Actions
        </p>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={analyzingAll}
            onClick={handleAnalyzeAll}
          >
            {analyzingAll ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Analyze All
          </Button>
          <CommunicationModal
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
              >
                <MessageSquare className="size-4" />
                Communication
              </Button>
            }
          />
        </div>
      </div>
    </aside>
  );
}
