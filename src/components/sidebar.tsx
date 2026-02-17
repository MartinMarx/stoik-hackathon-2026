"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ExternalLink,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/features", label: "Features", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [sendingLeaderboard, setSendingLeaderboard] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch("/api/teams");
        if (!res.ok) throw new Error("Failed to fetch teams");
        const data = await res.json();
        setTeams(Array.isArray(data) ? data : data.teams ?? []);
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

  async function handleSendLeaderboard() {
    setSendingLeaderboard(true);
    try {
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leaderboard" }),
      });
      if (!res.ok) throw new Error("Failed to send leaderboard");
      toast.success("Leaderboard sent", {
        description: "Leaderboard posted to Slack.",
      });
    } catch (err) {
      toast.error("Send failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSendingLeaderboard(false);
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
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
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
          return (
            <Link
              key={team.id}
              href={teamHref}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isTeamActive &&
                  "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              )}
            >
              <Users className="size-4" />
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
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            disabled={sendingLeaderboard}
            onClick={handleSendLeaderboard}
          >
            {sendingLeaderboard ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send Leaderboard
          </Button>
        </div>
      </div>
    </aside>
  );
}
