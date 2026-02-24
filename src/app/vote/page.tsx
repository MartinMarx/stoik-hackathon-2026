"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Vote, Users } from "lucide-react";
import type { VotesResponse, VoteTeam } from "@/types";
import { VoteCard } from "@/components/vote-card";
import { VoteConfirmationDialog } from "@/components/vote-confirmation-dialog";
import { VoteReveal } from "@/components/vote-reveal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_TEAM_ID = "vote_team_id";
const STORAGE_VOTE_CAST = "vote_cast";

function getStoredTeamId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_TEAM_ID);
}

function getStoredVoteCast(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_VOTE_CAST);
}

export default function VotePage() {
  const [data, setData] = useState<VotesResponse | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamSelectionPending, setTeamSelectionPending] =
    useState<VoteTeam | null>(null);
  const [confirmTeam, setConfirmTeam] = useState<VoteTeam | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const sortTeams = (d: VotesResponse) => {
    d.teams.sort((a, b) => a.name.localeCompare(b.name));
    return d;
  };

  const fetchVotes = useCallback(async () => {
    try {
      const res = await fetch("/api/votes");
      if (res.ok) {
        const json: VotesResponse = await res.json();
        setData(sortTeams(json));
      }
    } catch (err) {
      console.error("Fetch votes error:", err);
    }
  }, []);

  useEffect(() => {
    setSelectedTeamId(getStoredTeamId());
    fetchVotes();
  }, [fetchVotes]);

  useEffect(() => {
    if (!data) return;
    const es = new EventSource("/api/events/stream");
    es.addEventListener("vote", (e: MessageEvent) => {
      try {
        const payload: VotesResponse = JSON.parse(e.data);
        setData(sortTeams(payload));
      } catch {
        // ignore
      }
    });
    return () => es.close();
  }, [data !== null]);

  const handleSelectTeam = (team: VoteTeam) => {
    localStorage.setItem(STORAGE_TEAM_ID, team.teamId);
    setSelectedTeamId(team.teamId);
    setTeamSelectionPending(null);
  };

  const handleVoteClick = (team: VoteTeam) => {
    setConfirmTeam(team);
  };

  const handleConfirmVote = async () => {
    if (!confirmTeam || !selectedTeamId) return;
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voterTeamId: selectedTeamId,
          votedForTeamId: confirmTeam.teamId,
        }),
      });
      if (res.ok) {
        localStorage.setItem(STORAGE_VOTE_CAST, confirmTeam.name);
        const json: VotesResponse = await res.json();
        setData(sortTeams(json));
        setConfirmTeam(null);
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const votedForName = getStoredVoteCast();
  const hasVoted = !!votedForName;

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 animate-spin rounded-full border-2 border-white/20 border-t-indigo-400" />
          <p className="text-white/60">Loading…</p>
        </div>
      </div>
    );
  }

  if (!selectedTeamId) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 size-80 rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute -bottom-40 -right-40 size-80 rounded-full bg-purple-500/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h1 className="flex items-center justify-center gap-3 text-3xl font-black tracking-tight text-white lg:text-4xl">
                <Users className="size-9 text-indigo-400" />
                Which team are you?
              </h1>
              <p className="mt-2 text-white/50">
                Select your team to cast your vote
              </p>
            </div>
            <div className="grid gap-3">
              {data.teams.map((team) => (
                <motion.button
                  key={team.teamId}
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setTeamSelectionPending(team)}
                  className="rounded-2xl border border-white/6 bg-[#12121a]/90 p-4 text-left backdrop-blur-sm transition-colors hover:border-indigo-500/30 hover:bg-[#12121a]"
                >
                  <span className="font-semibold text-white">{team.name}</span>
                </motion.button>
              ))}
            </div>

            <Dialog
              open={!!teamSelectionPending}
              onOpenChange={(open) => !open && setTeamSelectionPending(null)}
            >
              <DialogContent className="z-100 border-white/10 bg-[#12121a] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    You are {teamSelectionPending?.name}?
                  </DialogTitle>
                  <DialogDescription className="text-white/60">
                    You will vote as this team. You can change your team later
                    by clearing your selection.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter showCloseButton={false} className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setTeamSelectionPending(null)}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      teamSelectionPending &&
                      handleSelectTeam(teamSelectionPending)
                    }
                    className="bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Confirm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </motion.div>
        </div>
      </div>
    );
  }

  if (data.voteEnded) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 size-80 rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute -bottom-40 -right-40 size-80 rounded-full bg-purple-500/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 py-12">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <h1 className="flex items-center justify-center gap-3 text-3xl font-black tracking-tight text-white lg:text-4xl">
              <Vote className="size-9 text-indigo-400" />
              Results
            </h1>
          </motion.div>
          <VoteReveal teams={data.teams} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-80 rounded-full bg-indigo-500/20 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 size-80 rounded-full bg-purple-500/20 blur-[100px]" />
      </div>
      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col items-center gap-2 text-center"
        >
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white lg:text-4xl">
            <Vote className="size-9 text-indigo-400" />
            Vote for your favorite
          </h1>
        </motion.header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.teams.map((team) => (
            <VoteCard
              key={team.teamId}
              team={team}
              isOwnTeam={team.teamId === selectedTeamId}
              votedForName={votedForName ?? undefined}
              onVote={() => handleVoteClick(team)}
            />
          ))}
        </div>
      </div>

      <VoteConfirmationDialog
        open={!!confirmTeam}
        onOpenChange={(open) => !open && setConfirmTeam(null)}
        teamName={confirmTeam?.name ?? ""}
        isChange={hasVoted && confirmTeam?.name !== votedForName}
        onConfirm={handleConfirmVote}
        isLoading={submitLoading}
      />
    </div>
  );
}
