"use client";

import { useState } from "react";
import type {
  UnlockedAchievement,
  AchievementCategory,
  AchievementDefinition,
} from "@/types";
import { ACHIEVEMENTS } from "@/lib/achievements/definitions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface AchievementWallProps {
  unlocked: UnlockedAchievement[];
  teamId: string;
  showLocked?: boolean;
}

const rarityBorderColor: Record<string, string> = {
  common: "border-zinc-400",
  rare: "border-blue-500",
  epic: "border-purple-500",
  legendary: "border-yellow-500",
};

const rarityBgHover: Record<string, string> = {
  common: "hover:bg-zinc-50 dark:hover:bg-zinc-900",
  rare: "hover:bg-blue-50 dark:hover:bg-blue-950",
  epic: "hover:bg-purple-50 dark:hover:bg-purple-950",
  legendary: "hover:bg-yellow-50 dark:hover:bg-yellow-950",
};

const categoryLabels: Record<AchievementCategory, string> = {
  implementation: "Implementation",
  git: "Git",
  agentic: "Agentic",
  "cursor-usage": "Cursor",
  "code-quality": "Quality",
  design: "Design",
  collaboration: "Collab",
  speed: "Speed",
  features: "Features",
  fun: "Fun",
};

const allCategories: AchievementCategory[] = [
  "implementation",
  "git",
  "agentic",
  "cursor-usage",
  "code-quality",
  "design",
  "collaboration",
  "speed",
  "features",
  "fun",
];

function AchievementTile({
  definition,
  unlocked,
  adminView,
}: {
  definition: AchievementDefinition;
  unlocked?: UnlockedAchievement;
  adminView?: boolean;
}) {
  const isUnlocked = !!unlocked;

  const tile = (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition-all",
        isUnlocked
          ? cn(rarityBorderColor[definition.rarity], rarityBgHover[definition.rarity])
          : "border-dashed border-muted-foreground/30 opacity-30",
      )}
    >
      <span className="text-2xl">{definition.icon}</span>
      <span className="text-xs font-medium leading-tight">
        {isUnlocked || adminView ? definition.name : "???"}
      </span>
    </div>
  );

  if (!isUnlocked && !adminView) return tile;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{tile}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-semibold">{definition.name}</p>
          <p className="text-xs opacity-80">{definition.description}</p>
          {isUnlocked && (
            <p className="text-xs opacity-60">
              Unlocked: {new Date(unlocked!.unlockedAt).toLocaleString()}
            </p>
          )}
          {!isUnlocked && adminView && (
            <p className="text-xs opacity-60">Not yet unlocked</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function AchievementWall({ unlocked, teamId, showLocked = true }: AchievementWallProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [earnedOnly, setEarnedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const safeUnlocked = unlocked ?? [];
  const unlockedMap = new Map(safeUnlocked.map((a) => [a.id, a]));
  const unlockedCount = safeUnlocked.length;
  const totalCount = ACHIEVEMENTS.length;

  const filteredAchievements = ACHIEVEMENTS.filter((a) => {
    if (earnedOnly && !unlockedMap.has(a.id)) return false;
    if (activeTab !== "all" && a.category !== activeTab) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-5 text-yellow-500" />
          Achievements
        </CardTitle>
        <CardDescription>
          {unlockedCount}/{totalCount} unlocked
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search achievements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <button
              type="button"
              onClick={() => setEarnedOnly(!earnedOnly)}
              className={cn(
                "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                earnedOnly
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Earned
            </button>
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            {allCategories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="text-xs">
                {categoryLabels[cat]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <TooltipProvider>
          <div className="max-h-64 overflow-y-auto pr-1">
            <div className="grid grid-cols-4 gap-2 xl:grid-cols-5">
              {filteredAchievements.map((def) => (
                <AchievementTile
                  key={def.id}
                  definition={def}
                  unlocked={unlockedMap.get(def.id)}
                  adminView={showLocked}
                />
              ))}
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
