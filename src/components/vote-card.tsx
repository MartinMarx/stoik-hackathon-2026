"use client";

import { motion } from "framer-motion";
import { Vote } from "lucide-react";
import type { VoteTeam } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface VoteCardProps {
  team: VoteTeam;
  isOwnTeam: boolean;
  votedForName?: string;
  onVote: () => void;
}

export function VoteCard({
  team,
  isOwnTeam,
  votedForName,
  onVote,
}: VoteCardProps) {
  const showVotedFor = votedForName === team.name;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      whileHover={!isOwnTeam ? { scale: 1.02 } : undefined}
      className="relative overflow-hidden rounded-2xl border border-white/6 bg-[#12121a]/90 backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold tracking-tight text-white lg:text-xl">
              {team.name}
            </h3>
            {team.memberNames?.length ? (
              <p className="mt-1 text-xs text-white/50">
                {team.memberNames
                  .map((m) =>
                    [m.firstName, m.lastName].filter(Boolean).join(" "),
                  )
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {isOwnTeam ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/60">
              Your team
            </span>
          ) : showVotedFor ? (
            <span className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-400">
              <Vote className="size-4" />
              You voted
            </span>
          ) : (
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onVote();
              }}
              disabled={isOwnTeam}
              className={cn(
                "bg-linear-to-r from-indigo-500 to-purple-600 font-semibold text-white shadow-lg transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/25",
                isOwnTeam && "opacity-50",
              )}
            >
              <Vote className="size-4" />
              Vote
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
