"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Flag,
  Info,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Trash,
  Users,
  Vote,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMemberName {
  firstName: string;
  lastName: string;
}

interface Team {
  id: string;
  name: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  slackChannelId: string | null;
  appUrl: string | null;
  envContent: string | null;
  memberNames?: TeamMemberName[];
  createdAt: string;
  latestScore: { total: number } | null;
  achievementCount: number;
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  // ---- Team state ----
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [addTeamSlackChannelId, setAddTeamSlackChannelId] = useState("");
  const [addTeamEnvContent, setAddTeamEnvContent] = useState("");
  const [addTeamAppUrl, setAddTeamAppUrl] = useState("");
  const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
  const [addingTeam, setAddingTeam] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [draftAppUrl, setDraftAppUrl] = useState("");
  const [draftSlackChannelId, setDraftSlackChannelId] = useState("");
  const [draftMemberNames, setDraftMemberNames] = useState<TeamMemberName[]>(
    [],
  );
  const [envContentByTeamId, setEnvContentByTeamId] = useState<
    Record<string, string>
  >({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [resendWelcomeTeamId, setResendWelcomeTeamId] = useState<string | null>(
    null,
  );

  // ---- Action state ----
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [sendingLeaderboard, setSendingLeaderboard] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [webhookPayloadUrl, setWebhookPayloadUrl] = useState("");
  const [voteEnded, setVoteEnded] = useState(false);
  const [endingVote, setEndingVote] = useState(false);
  const [resettingVote, setResettingVote] = useState(false);
  const [mcpPaused, setMcpPaused] = useState(false);
  const [githubWebhooksPaused, setGithubWebhooksPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(true);
  const [pauseUpdating, setPauseUpdating] = useState(false);
  const [hackathonEnded, setHackathonEnded] = useState(false);
  const [endingHackathon, setEndingHackathon] = useState(false);
  const [hackathonEndDialogOpen, setHackathonEndDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWebhookPayloadUrl(`${window.location.origin}/api/webhooks/github`);
    }
  }, []);

  // ---- Fetch teams ----
  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data: Team[] = await res.json();
      setTeams(data.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      toast.error("Failed to load teams", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    fetch("/api/votes")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { voteEnded?: boolean } | null) => {
        if (data && typeof data.voteEnded === "boolean")
          setVoteEnded(data.voteEnded);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/pause")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: { mcpPaused?: boolean; githubWebhooksPaused?: boolean } | null,
        ) => {
          if (data) {
            if (typeof data.mcpPaused === "boolean")
              setMcpPaused(data.mcpPaused);
            if (typeof data.githubWebhooksPaused === "boolean")
              setGithubWebhooksPaused(data.githubWebhooksPaused);
          }
        },
      )
      .catch(() => {})
      .finally(() => setPauseLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/hackathon/end")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ended?: boolean } | null) => {
        if (data && typeof data.ended === "boolean")
          setHackathonEnded(data.ended);
      })
      .catch(() => {});
  }, []);

  function isValidGitHubUrl(url: string): boolean {
    try {
      const u = new URL(url.trim());
      if (u.hostname !== "github.com") return false;
      const segments = u.pathname.split("/").filter(Boolean);
      return segments.length >= 2;
    } catch {
      return false;
    }
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = teamName.trim();
    const trimmedUrl = repoUrl.trim();
    const trimmedSlack = addTeamSlackChannelId.trim();
    const trimmedEnv = addTeamEnvContent.trim();
    const trimmedAppUrl = addTeamAppUrl.trim();

    if (!trimmedName) {
      toast.error("Team name is required");
      return;
    }
    if (!trimmedUrl) {
      toast.error("GitHub Repo URL is required");
      return;
    }
    if (!isValidGitHubUrl(trimmedUrl)) {
      toast.error("Invalid GitHub URL. Use https://github.com/owner/repo");
      return;
    }
    if (!trimmedSlack) {
      toast.error("Slack channel ID is required");
      return;
    }
    if (!trimmedEnv) {
      toast.error(".env content is required");
      return;
    }

    setAddingTeam(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          repoUrl: trimmedUrl,
          slackChannelId: trimmedSlack,
          envContent: trimmedEnv,
          ...(trimmedAppUrl ? { appUrl: trimmedAppUrl } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to add team");
      }

      toast.success("Team added", {
        description: `"${trimmedName}" has been registered.`,
      });
      if (data.welcomeSent === false) {
        toast.warning("Welcome message could not be sent to Slack.", {
          description:
            "You can resend instructions from the team channel manually.",
        });
      }
      setTeamName("");
      setRepoUrl("");
      setAddTeamSlackChannelId("");
      setAddTeamEnvContent("");
      setAddTeamAppUrl("");
      setAddTeamModalOpen(false);
      await fetchTeams();
    } catch (err) {
      toast.error("Failed to add team", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setAddingTeam(false);
    }
  }

  // ---- Remove team ----
  async function handleRemoveTeam(id: string) {
    setRemovingTeamId(id);
    try {
      const res = await fetch(`/api/teams?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to remove team");
      }

      toast.success("Team removed");
      await fetchTeams();
    } catch (err) {
      toast.error("Failed to remove team", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setRemovingTeamId(null);
    }
  }

  // ---- Update Slack channel ----
  async function handleSaveAppUrl(teamId: string) {
    const value = expandedTeamId === teamId ? draftAppUrl : "";
    setSavingField(`appUrl:${teamId}`);
    try {
      const res = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId, appUrl: value.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update");
      }
      toast.success("App URL updated");
      await fetchTeams();
    } catch (err) {
      toast.error("Update failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSavingField(null);
    }
  }

  async function handleSaveSlackChannel(teamId: string) {
    const value = expandedTeamId === teamId ? draftSlackChannelId : "";
    setSavingField(`slack:${teamId}`);
    try {
      const res = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: teamId,
          slackChannelId: value.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update");
      }
      toast.success("Slack channel updated");
      await fetchTeams();
    } catch (err) {
      toast.error("Update failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSavingField(null);
    }
  }

  async function handleSaveEnv(teamId: string) {
    const value =
      envContentByTeamId[teamId] ??
      teams.find((t) => t.id === teamId)?.envContent ??
      "";
    setSavingField(`env:${teamId}`);
    try {
      const res = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId, envContent: value.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update");
      }
      toast.success(".env content updated");
      setEnvContentByTeamId((prev) => {
        const next = { ...prev };
        delete next[teamId];
        return next;
      });
      await fetchTeams();
    } catch (err) {
      toast.error("Update failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSavingField(null);
    }
  }

  async function handleSaveMemberNames(teamId: string) {
    const value =
      expandedTeamId === teamId
        ? draftMemberNames.filter(
            (m) => m.firstName.trim() || m.lastName.trim(),
          )
        : [];
    setSavingField(`memberNames:${teamId}`);
    try {
      const res = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId, memberNames: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update");
      }
      toast.success("Member names updated");
      await fetchTeams();
    } catch (err) {
      toast.error("Update failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSavingField(null);
    }
  }

  // ---- Analyze all ----
  async function handleAnalyzeAll() {
    setAnalyzingAll(true);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      toast.success("Analysis triggered", {
        description:
          data.message ??
          `Analysis started for ${data.teamsTriggered ?? 0} team(s).`,
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

  // ---- Send leaderboard ----
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

  async function handleEndVote() {
    setEndingVote(true);
    try {
      const res = await fetch("/api/votes/end", { method: "POST" });
      if (!res.ok) throw new Error("Failed to end vote");
      setVoteEnded(true);
      toast.success("Vote ended", {
        description: "Everyone will see the final results and animation.",
      });
    } catch (err) {
      toast.error("Failed to end vote", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setEndingVote(false);
    }
  }

  async function handleResetVote() {
    setResettingVote(true);
    try {
      const res = await fetch("/api/votes/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset vote");
      setVoteEnded(false);
      toast.success("Vote reset", {
        description:
          "All votes cleared and vote reopened. Participants can vote again.",
      });
    } catch (err) {
      toast.error("Failed to reset vote", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setResettingVote(false);
    }
  }

  async function handleEndHackathon() {
    setEndingHackathon(true);
    try {
      const res = await fetch("/api/hackathon/end", { method: "POST" });
      if (!res.ok) throw new Error("Failed to end hackathon");
      setHackathonEnded(true);
      setGithubWebhooksPaused(true);
      setHackathonEndDialogOpen(false);
      toast.success("Hackathon ended", {
        description: "Commits frozen for all teams. Final analysis is running.",
      });
    } catch (err) {
      toast.error("Failed to end hackathon", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setEndingHackathon(false);
    }
  }

  // ---- Send announcement ----
  async function handleSendAnnouncement(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = announcementMessage.trim();
    if (!trimmed) {
      toast.error("Message cannot be empty");
      return;
    }

    setSendingAnnouncement(true);
    try {
      const res = await fetch("/api/slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "announcement",
          data: { message: trimmed },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to send announcement");
      }

      toast.success("Announcement sent", {
        description: "Custom announcement posted to Slack.",
      });
      setAnnouncementMessage("");
    } catch (err) {
      toast.error("Send failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSendingAnnouncement(false);
    }
  }

  // ---- Render ----
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage teams, trigger actions, and check system status.
        </p>
      </div>

      {/* ─── Section 1: Team Management ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Team Management
          </CardTitle>
          <CardDescription>
            Register hackathon teams and manage their GitHub repositories.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Dialog open={addTeamModalOpen} onOpenChange={setAddTeamModalOpen}>
            <Button onClick={() => setAddTeamModalOpen(true)}>
              <Plus className="size-4" />
              Add team
            </Button>
            <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <DialogHeader className="shrink-0">
                <DialogTitle>Add team</DialogTitle>
                <DialogDescription>
                  Register a new hackathon team. Slack channel ID and .env
                  content are required; a welcome message will be sent to the
                  channel.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <form
                  onSubmit={handleAddTeam}
                  className="space-y-4"
                  id="add-team-form"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="add-team-name"
                      className="text-sm font-medium leading-none"
                    >
                      Team name
                    </label>
                    <Input
                      id="add-team-name"
                      placeholder="e.g. Team Rocket"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      disabled={addingTeam}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="add-team-repo-url"
                      className="text-sm font-medium leading-none"
                    >
                      GitHub Repo URL
                    </label>
                    <Input
                      id="add-team-repo-url"
                      placeholder="https://github.com/org/repo"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      disabled={addingTeam}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="add-team-slack"
                      className="text-sm font-medium leading-none"
                    >
                      Slack channel ID
                    </label>
                    <Input
                      id="add-team-slack"
                      placeholder="e.g. C01234ABCD"
                      value={addTeamSlackChannelId}
                      onChange={(e) => setAddTeamSlackChannelId(e.target.value)}
                      disabled={addingTeam}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="add-team-env"
                      className="text-sm font-medium leading-none"
                    >
                      .env content
                    </label>
                    <Textarea
                      id="add-team-env"
                      placeholder="KEY=value (one key per line)"
                      value={addTeamEnvContent}
                      onChange={(e) => setAddTeamEnvContent(e.target.value)}
                      disabled={addingTeam}
                      rows={4}
                      className="font-mono text-sm resize-y max-h-48 overflow-y-auto"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="add-team-app-url"
                      className="text-sm font-medium leading-none"
                    >
                      App URL (optional)
                    </label>
                    <Input
                      id="add-team-app-url"
                      placeholder="https://..."
                      value={addTeamAppUrl}
                      onChange={(e) => setAddTeamAppUrl(e.target.value)}
                      disabled={addingTeam}
                    />
                  </div>
                </form>
              </div>
              <DialogFooter className="shrink-0">
                <DialogClose asChild>
                  <Button variant="outline" disabled={addingTeam}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  form="add-team-form"
                  type="submit"
                  disabled={addingTeam}
                >
                  {addingTeam ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Add team"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Separator />

          {/* Teams list */}
          {teamsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="ml-auto h-5 w-12" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No teams registered yet. Add one above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="rounded-md border px-4 py-3">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{team.name}</span>
                    <a
                      href={team.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                      title={team.repoUrl}
                    >
                      {team.repoOwner}/{team.repoName}
                    </a>

                    <div className="ml-auto flex items-center gap-3">
                      <Badge variant="secondary" className="tabular-nums">
                        {team.latestScore?.total ?? "---"} pts
                      </Badge>
                      <Badge variant="outline" className="tabular-nums">
                        {team.achievementCount}{" "}
                        {team.achievementCount === 1
                          ? "achievement"
                          : "achievements"}
                      </Badge>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const next =
                            expandedTeamId === team.id ? null : team.id;
                          setExpandedTeamId(next);
                          if (next === team.id) {
                            setDraftAppUrl(team.appUrl ?? "");
                            setDraftSlackChannelId(team.slackChannelId ?? "");
                            setDraftMemberNames(
                              [
                                ...(Array.isArray(team.memberNames)
                                  ? team.memberNames
                                  : []),
                                ...Array.from({ length: 5 }, () => ({
                                  firstName: "",
                                  lastName: "",
                                })),
                              ].slice(0, 5),
                            );
                          }
                        }}
                        title="Settings"
                      >
                        <Settings className="size-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash className="size-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Remove team</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to remove{" "}
                              <strong>{team.name}</strong>? This action cannot
                              be undone and will delete all associated data.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogClose>
                            <Button
                              variant="destructive"
                              disabled={removingTeamId === team.id}
                              onClick={() => handleRemoveTeam(team.id)}
                            >
                              {removingTeamId === team.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Remove"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {expandedTeamId === team.id && (
                    <div className="mt-3 space-y-3 rounded-md border bg-muted/30 p-3">
                      <div className="grid gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Webhook
                        </label>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          {webhookPayloadUrl ? (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex cursor-help text-muted-foreground hover:text-foreground">
                                    <Info className="size-3.5" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <p className="font-medium">Payload URL</p>
                                  <p className="mt-1 break-all text-muted-foreground">
                                    {webhookPayloadUrl}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : null}
                          <a
                            href={`https://github.com/${team.repoOwner}/${team.repoName}/settings/hooks/new`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                          >
                            Configure webhook
                            <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          App URL
                        </label>
                        <div className="flex gap-2">
                          <Input
                            className="h-8 flex-1 text-xs"
                            placeholder="https://team-app.example.com"
                            value={draftAppUrl}
                            onChange={(e) => setDraftAppUrl(e.target.value)}
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            disabled={savingField === `appUrl:${team.id}`}
                            onClick={() => handleSaveAppUrl(team.id)}
                          >
                            {savingField === `appUrl:${team.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Slack channel ID
                        </label>
                        <div className="flex gap-2">
                          <Input
                            className="h-8 flex-1 text-xs"
                            placeholder="e.g. C0123456789"
                            value={draftSlackChannelId}
                            onChange={(e) =>
                              setDraftSlackChannelId(e.target.value)
                            }
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            disabled={savingField === `slack:${team.id}`}
                            onClick={() => handleSaveSlackChannel(team.id)}
                          >
                            {savingField === `slack:${team.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          {team.slackChannelId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              disabled={resendWelcomeTeamId === team.id}
                              onClick={async () => {
                                setResendWelcomeTeamId(team.id);
                                try {
                                  const res = await fetch("/api/slack", {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      action: "resend-welcome",
                                      data: { teamId: team.id },
                                    }),
                                  });
                                  const json = await res.json();
                                  if (!res.ok) {
                                    toast.error(
                                      json.error ?? "Failed to resend welcome",
                                    );
                                    return;
                                  }
                                  toast.success(
                                    "Welcome message sent to team Slack channel",
                                  );
                                } finally {
                                  setResendWelcomeTeamId(null);
                                }
                              }}
                            >
                              {resendWelcomeTeamId === team.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Resend welcome"
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          Member names (display only, e.g. for voting page)
                        </label>
                        <div className="space-y-2">
                          {(expandedTeamId === team.id
                            ? draftMemberNames
                            : [
                                ...(Array.isArray(team.memberNames)
                                  ? team.memberNames
                                  : []),
                                ...Array.from({ length: 5 }, () => ({
                                  firstName: "",
                                  lastName: "",
                                })),
                              ].slice(0, 5)
                          ).map((m, i) => (
                            <div key={i} className="flex gap-2">
                              <Input
                                className="h-8 flex-1 text-xs"
                                placeholder="First name"
                                value={
                                  expandedTeamId === team.id
                                    ? (draftMemberNames[i]?.firstName ?? "")
                                    : (m as TeamMemberName).firstName
                                }
                                onChange={(e) =>
                                  expandedTeamId === team.id &&
                                  setDraftMemberNames((prev) => {
                                    const next = [...prev];
                                    next[i] = {
                                      ...(next[i] ?? {
                                        firstName: "",
                                        lastName: "",
                                      }),
                                      firstName: e.target.value,
                                    };
                                    return next;
                                  })
                                }
                                disabled={expandedTeamId !== team.id}
                              />
                              <Input
                                className="h-8 flex-1 text-xs"
                                placeholder="Last name"
                                value={
                                  expandedTeamId === team.id
                                    ? (draftMemberNames[i]?.lastName ?? "")
                                    : (m as TeamMemberName).lastName
                                }
                                onChange={(e) =>
                                  expandedTeamId === team.id &&
                                  setDraftMemberNames((prev) => {
                                    const next = [...prev];
                                    next[i] = {
                                      ...(next[i] ?? {
                                        firstName: "",
                                        lastName: "",
                                      }),
                                      lastName: e.target.value,
                                    };
                                    return next;
                                  })
                                }
                                disabled={expandedTeamId !== team.id}
                              />
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-fit"
                          disabled={savingField === `memberNames:${team.id}`}
                          onClick={() => handleSaveMemberNames(team.id)}
                        >
                          {savingField === `memberNames:${team.id}` ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Save member names"
                          )}
                        </Button>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          .env file content
                        </label>
                        <div className="flex gap-2">
                          <Textarea
                            className="min-h-[72px] flex-1 font-mono text-xs"
                            placeholder={
                              "ANTHROPIC_API_KEY=sk-...\nRAILWAY_TOKEN=..."
                            }
                            value={
                              envContentByTeamId[team.id] ??
                              team.envContent ??
                              ""
                            }
                            onChange={(e) =>
                              setEnvContentByTeamId((prev) => ({
                                ...prev,
                                [team.id]: e.target.value,
                              }))
                            }
                            rows={3}
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0"
                            disabled={savingField === `env:${team.id}`}
                            onClick={() => handleSaveEnv(team.id)}
                          >
                            {savingField === `env:${team.id}` ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 2: Actions ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5" />
            Actions
          </CardTitle>
          <CardDescription>
            Trigger analysis runs and Slack notifications.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              disabled={analyzingAll}
              onClick={handleAnalyzeAll}
            >
              {analyzingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <div className="text-left">
                <div className="font-medium">Analyze All Teams</div>
                <div className="text-xs text-muted-foreground">
                  Run analysis pipeline for every registered team
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-auto justify-start gap-3 px-4 py-3"
              disabled={sendingLeaderboard}
              onClick={handleSendLeaderboard}
            >
              {sendingLeaderboard ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              <div className="text-left">
                <div className="font-medium">Send Leaderboard to Slack</div>
                <div className="text-xs text-muted-foreground">
                  Post the current standings to the Slack channel
                </div>
              </div>
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="text-sm font-medium">Pause</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-md border px-4 py-3">
                <div>
                  <div className="font-medium">MCP server</div>
                  <div className="text-xs text-muted-foreground">
                    {pauseLoading ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> Loading…
                      </span>
                    ) : mcpPaused ? (
                      "Paused — Cursor MCP tools will return 503"
                    ) : (
                      "Running"
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pauseLoading || pauseUpdating}
                  onClick={async () => {
                    setPauseUpdating(true);
                    try {
                      const res = await fetch("/api/settings/pause", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ mcpPaused: !mcpPaused }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        toast.error(data.error ?? "Failed to update");
                        return;
                      }
                      if (typeof data.mcpPaused === "boolean")
                        setMcpPaused(data.mcpPaused);
                      toast.success(
                        data.mcpPaused
                          ? "MCP server paused"
                          : "MCP server resumed",
                      );
                    } finally {
                      setPauseUpdating(false);
                    }
                  }}
                >
                  {pauseUpdating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : mcpPaused ? (
                    <>
                      <Play className="size-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="size-4" />
                      Pause
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border px-4 py-3">
                <div>
                  <div className="font-medium">GitHub webhooks</div>
                  <div className="text-xs text-muted-foreground">
                    {pauseLoading ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> Loading…
                      </span>
                    ) : githubWebhooksPaused ? (
                      "Paused — push events will be ignored"
                    ) : (
                      "Running"
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pauseLoading || pauseUpdating}
                  onClick={async () => {
                    setPauseUpdating(true);
                    try {
                      const res = await fetch("/api/settings/pause", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          githubWebhooksPaused: !githubWebhooksPaused,
                        }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        toast.error(data.error ?? "Failed to update");
                        return;
                      }
                      if (typeof data.githubWebhooksPaused === "boolean")
                        setGithubWebhooksPaused(data.githubWebhooksPaused);
                      toast.success(
                        data.githubWebhooksPaused
                          ? "GitHub webhooks paused"
                          : "GitHub webhooks resumed",
                      );
                    } finally {
                      setPauseUpdating(false);
                    }
                  }}
                >
                  {pauseUpdating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : githubWebhooksPaused ? (
                    <>
                      <Play className="size-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="size-4" />
                      Pause
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Custom announcement */}
          <form onSubmit={handleSendAnnouncement} className="space-y-3">
            <label
              htmlFor="announcement"
              className="text-sm font-medium leading-none"
            >
              Send Custom Announcement
            </label>
            <Textarea
              id="announcement"
              placeholder="Type your announcement message..."
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              disabled={sendingAnnouncement}
              rows={3}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={sendingAnnouncement || !announcementMessage.trim()}
            >
              {sendingAnnouncement ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Send Announcement
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ─── Section: End Hackathon ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="size-5" />
            End Hackathon
          </CardTitle>
          <CardDescription>
            Freeze each team&apos;s latest commit on main and run a final
            analysis. After ending, push webhooks are disabled and all future
            analyses use the frozen commit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hackathonEnded ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-green-600" />
              Hackathon ended. Commits are frozen and webhooks are paused.
            </div>
          ) : (
            <Dialog
              open={hackathonEndDialogOpen}
              onOpenChange={setHackathonEndDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Flag className="size-4" />
                  End Hackathon
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>End Hackathon</DialogTitle>
                  <DialogDescription>
                    This will freeze each team&apos;s latest commit on main,
                    pause GitHub webhooks, and trigger a final analysis for all
                    teams. This action cannot be easily undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={endingHackathon}>
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    disabled={endingHackathon}
                    onClick={handleEndHackathon}
                  >
                    {endingHackathon ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>

      {/* ─── Section: Vote ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Vote className="size-5" />
            Vote
          </CardTitle>
          <CardDescription>
            End the demo vote manually. All participants will then see the top 3
            reveal and full leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <a
            href="/vote"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline mb-4 block"
          >
            <ExternalLink className="size-4" />
            Open vote page
          </a>
          {voteEnded ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                Vote ended. Results are visible on the vote page.
              </div>
              <Button
                variant="outline"
                disabled={resettingVote}
                onClick={handleResetVote}
                className="text-muted-foreground"
              >
                {resettingVote ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Reset vote
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              disabled={endingVote}
              onClick={handleEndVote}
            >
              {endingVote ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Vote className="size-4" />
              )}
              End vote
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── Section 3: Status ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Service configuration status. All integrations are configured via
            environment variables on the server.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Slack", description: "Bot token & channel" },
              { label: "GitHub", description: "API access token" },
              { label: "Anthropic", description: "Claude API key" },
              { label: "Database", description: "PostgreSQL connection" },
            ].map((service) => (
              <div
                key={service.label}
                className="flex flex-col gap-1 rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span className="text-sm font-medium">{service.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {service.description}
                </span>
                <Badge
                  variant="secondary"
                  className="mt-1 w-fit bg-emerald-500/10 text-emerald-600"
                >
                  Configured
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
