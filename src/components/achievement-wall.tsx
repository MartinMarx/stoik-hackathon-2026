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

const CUSTOM_PREFIX = "custom:";

const categoryLabels: Record<AchievementCategory, string> = {
  implementation: "Implementation",
  git: "Git",
  "code-quality": "Quality",
  design: "Design",
  speed: "Speed",
  features: "Features",
  fun: "Fun",
};

const allCategories: AchievementCategory[] = [
  "implementation",
  "git",
  "code-quality",
  "design",
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
          ? cn(
              rarityBorderColor[definition.rarity],
              rarityBgHover[definition.rarity],
            )
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

export function AchievementWall({
  unlocked,
  teamId,
  showLocked = true,
}: AchievementWallProps) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [earnedOnly, setEarnedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const safeUnlocked = unlocked ?? [];
  const unlockedMap = new Map(safeUnlocked.map((a) => [a.id, a]));
  const customUnlocked = safeUnlocked.filter((a) =>
    a.id.startsWith(CUSTOM_PREFIX),
  );
  const customDefinitionsMap = new Map(customUnlocked.map((a) => [a.id, a]));
  const customDefinitions = Array.from(customDefinitionsMap.values());
  const unlockedCount = safeUnlocked.length;
  const allDefinitions: AchievementDefinition[] = [
    ...ACHIEVEMENTS,
    ...customDefinitions,
  ];
  const totalCount = allDefinitions.length;

  const filteredAchievements = allDefinitions.filter((a) => {
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
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search achievements..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <label className="flex shrink-0 items-center gap-2 cursor-pointer text-xs font-medium">
            <input
              type="checkbox"
              checked={earnedOnly}
              onChange={(e) => setEarnedOnly(e.target.checked)}
              className="size-3.5 rounded border-input accent-primary"
            />
            Earned
          </label>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-nowrap h-auto gap-1 overflow-x-auto w-full">
            <TabsTrigger value="all" className="text-xs shrink-0">
              All
            </TabsTrigger>
            {allCategories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="text-xs shrink-0">
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
