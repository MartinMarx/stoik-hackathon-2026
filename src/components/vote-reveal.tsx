"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";
import confetti from "canvas-confetti";
import type { VoteTeam } from "@/types";
import { cn } from "@/lib/utils";

const RANK_GRADIENTS: Record<
  number,
  { border: string; bg: string; glow: string; badge: string }
> = {
  1: {
    border: "from-yellow-400 via-amber-300 to-yellow-500",
    bg: "from-yellow-500/10 via-amber-500/5 to-transparent",
    glow: "0 0 40px rgba(250, 204, 21, 0.15), 0 0 80px rgba(250, 204, 21, 0.05)",
    badge: "from-yellow-400 to-amber-500",
  },
  2: {
    border: "from-slate-300 via-gray-200 to-slate-400",
    bg: "from-slate-300/8 via-gray-200/4 to-transparent",
    glow: "0 0 30px rgba(203, 213, 225, 0.1), 0 0 60px rgba(203, 213, 225, 0.03)",
    badge: "from-slate-300 to-gray-400",
  },
  3: {
    border: "from-orange-400 via-amber-600 to-orange-500",
    bg: "from-orange-500/8 via-amber-600/4 to-transparent",
    glow: "0 0 25px rgba(251, 146, 60, 0.1), 0 0 50px rgba(251, 146, 60, 0.03)",
    badge: "from-orange-400 to-amber-600",
  },
};

const REVEAL_DELAY_MS = 2800;
const LEADERBOARD_DELAY_MS = 1200;

interface VoteRevealProps {
  teams: VoteTeam[];
}

function fireConfetti(intensity: number) {
  const count = 80 * intensity;
  const defaults = { origin: { y: 0.6 }, zIndex: 100 };
  confetti({ ...defaults, particleCount: count });
  confetti({ ...defaults, spread: 100, particleCount: count * 0.4 });
}

export function VoteReveal({ teams }: VoteRevealProps) {
  const sorted = [...teams].sort(
    (a, b) => b.voteCount - a.voteCount || b.autoScore - a.autoScore,
  );
  const topThree = sorted.slice(0, 3);
  const revealOrder = [topThree[2], topThree[1], topThree[0]];

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step <= 2) {
      const t = setTimeout(
        () => {
          fireConfetti(step === 2 ? 1.5 : 0.6 + step * 0.2);
          setStep((s) => s + 1);
        },
        step === 0 ? REVEAL_DELAY_MS : REVEAL_DELAY_MS,
      );
      return () => clearTimeout(t);
    }
    if (step === 3) {
      const t = setTimeout(() => setStep(4), LEADERBOARD_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <h2 className="text-xl font-semibold uppercase tracking-[0.2em] text-white/50">
        Top 3 by votes
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-6">
        <AnimatePresence mode="wait">
          {step >= 3 && revealOrder[2] && (
            <RevealCard key="1" team={revealOrder[2]} rank={1} />
          )}
          {step >= 2 && revealOrder[1] && (
            <RevealCard key="2" team={revealOrder[1]} rank={2} />
          )}
          {step >= 1 && revealOrder[0] && (
            <RevealCard key="3" team={revealOrder[0]} rank={3} />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {step >= 4 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-2xl space-y-4"
          >
            <h3 className="text-center text-lg font-semibold uppercase tracking-wider text-white/60">
              Full leaderboard
            </h3>
            <div className="space-y-2 rounded-2xl border border-white/6 bg-[#12121a]/90 p-4 backdrop-blur-sm">
              {sorted.map((team, i) => (
                <motion.div
                  key={team.teamId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/4 bg-white/2 px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-8 font-mono text-sm font-bold text-white/50">
                      #{i + 1}
                    </span>
                    <span className="font-semibold text-white">
                      {team.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="block text-xs text-white/40">
                        AI score
                      </span>
                      <span className="font-mono font-bold text-white/90">
                        {team.autoScore}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs text-white/40">Votes</span>
                      <span className="font-mono font-bold text-white/90">
                        {team.voteCount}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function RevealCard({ team, rank }: { team: VoteTeam; rank: number }) {
  const style = RANK_GRADIENTS[rank];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-[1.5px]",
        style && "shadow-lg",
      )}
      style={
        style
          ? {
              background: `linear-gradient(135deg, ${
                rank === 1
                  ? "#facc15, #f59e0b, #facc15"
                  : rank === 2
                    ? "#cbd5e1, #e5e7eb, #94a3b8"
                    : "#fb923c, #d97706, #fb923c"
              })`,
              boxShadow: style.glow,
            }
          : undefined
      }
    >
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-transparent bg-[#12121a] px-6 py-5",
          style && `bg-linear-to-r ${style.bg}`,
        )}
      >
        <div className="flex items-center gap-3">
          {rank === 1 && (
            <Crown
              className="size-8 text-yellow-400"
              style={{ filter: "drop-shadow(0 0 6px rgba(250, 204, 21, 0.5))" }}
            />
          )}
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl font-mono text-2xl font-black text-white"
            style={
              style
                ? {
                    background: `linear-gradient(135deg, ${
                      rank === 1
                        ? "#facc15, #d97706"
                        : rank === 2
                          ? "#cbd5e1, #94a3b8"
                          : "#fb923c, #b45309"
                    })`,
                  }
                : undefined
            }
          >
            {rank}
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            {team.name}
          </span>
        </div>
        <div className="flex gap-6">
          <div>
            <span className="text-xs text-white/50">AI score</span>
            <p className="font-mono text-2xl font-bold text-white">
              {team.autoScore}
            </p>
          </div>
          <div>
            <span className="text-xs text-white/50">Votes</span>
            <p className="font-mono text-2xl font-bold text-white">
              {team.voteCount}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
