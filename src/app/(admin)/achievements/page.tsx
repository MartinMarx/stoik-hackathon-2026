"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import type { AchievementCategory, AchievementRarity } from "@/types";
import { RARITY_POINTS } from "@/lib/achievements/definitions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CUSTOM_PREFIX = "custom:";

type AchievementRow = {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  customPoints?: number | null;
};

const RARITIES: AchievementRarity[] = ["common", "rare", "epic", "legendary"];
const CATEGORIES: AchievementCategory[] = [
  "implementation",
  "git",
  "code-quality",
  "design",
  "speed",
  "features",
  "fun",
];

const CATEGORY_LABELS: Record<string, string> = {
  implementation: "Implementation",
  git: "Git",
  "code-quality": "Quality",
  design: "Design",
  speed: "Speed",
  features: "Features",
  fun: "Fun",
};

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

function getPoints(d: AchievementRow) {
  return d.customPoints ?? RARITY_POINTS[d.rarity as AchievementRarity] ?? 0;
}

type SortKey = "name" | "rarity" | "category" | "points" | "teams";

function SortableHead({
  label,
  sortKey,
  currentSort,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSort === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground transition-colors"
      >
        {label}
        {isActive &&
          (sortDir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          ))}
      </button>
    </TableHead>
  );
}

function TeamsCountCell({
  achievementId,
  stats,
}: {
  achievementId: string;
  stats: Record<
    string,
    { count: number; teams: { id: string; name: string }[] }
  >;
}) {
  const s = stats[achievementId];
  const count = s?.count ?? 0;
  const teams = s?.teams ?? [];

  const trigger = (
    <span className="cursor-default font-medium tabular-nums">{count}</span>
  );

  if (count === 0)
    return <TableCell className="text-right">{trigger}</TableCell>;

  return (
    <TableCell className="text-right">
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="font-semibold mb-1">Teams ({count})</p>
          <ul className="text-xs space-y-0.5">
            {teams.map((t) => (
              <li key={t.id}>{t.name}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TableCell>
  );
}

function AddAchievementDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🏅");
  const [rarity, setRarity] = useState<AchievementRarity>("common");
  const [category, setCategory] = useState<AchievementCategory>("fun");
  const [points, setPoints] = useState<string>("");

  function reset() {
    setName("");
    setDescription("");
    setIcon("🏅");
    setRarity("common");
    setCategory("fun");
    setPoints("");
  }

  async function handleEnhance() {
    if (!name.trim() && !description.trim()) {
      toast.error("Enter a name or description first");
      return;
    }
    setEnhancing(true);
    try {
      const res = await fetch("/api/custom-achievements/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to enhance");
      }
      const data = await res.json();
      if (data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.icon) setIcon(data.icon);
      if (data.rarity && RARITIES.includes(data.rarity)) setRarity(data.rarity);
      if (data.category && CATEGORIES.includes(data.category))
        setCategory(data.category);
      if (typeof data.points === "number") setPoints(String(data.points));
      toast.success("Enhanced with AI");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enhance");
    } finally {
      setEnhancing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedPoints = points.trim() ? parseInt(points, 10) : undefined;
      const res = await fetch("/api/custom-achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          icon: icon.trim() || "🏅",
          rarity,
          category,
          ...(parsedPoints !== undefined &&
            !isNaN(parsedPoints) && { points: parsedPoints }),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create");
      }
      toast.success("Achievement created");
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Add achievement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add custom achievement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bug Whisperer"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did the team do to earn this?"
              required
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={enhancing || (!name.trim() && !description.trim())}
            onClick={handleEnhance}
          >
            {enhancing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            {enhancing ? "Enhancing..." : "Enhance with AI"}
          </Button>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Icon (emoji)</label>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🏅"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Points</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder={String(RARITY_POINTS[rarity] ?? 1)}
                className="w-20"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rarity</label>
              <Select
                value={rarity}
                onValueChange={(v) => setRarity(v as AchievementRarity)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RARITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as AchievementCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AchievementsPage() {
  const [data, setData] = useState<{
    definitions: AchievementRow[];
    stats: Record<
      string,
      { count: number; teams: { id: string; name: string }[] }
    >;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [pointsFilter, setPointsFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    setSortKey(key);
    setSortDir((d) =>
      key === sortKey ? (d === "asc" ? "desc" : "asc") : "asc",
    );
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/achievements");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData({
        definitions: json.definitions ?? [],
        stats: json.stats ?? {},
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load achievements",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const q = searchQuery.trim().toLowerCase();
  const filtered =
    data?.definitions.filter((d) => {
      if (q) {
        const nameMatch = d.name.toLowerCase().includes(q);
        const descMatch = d.description.toLowerCase().includes(q);
        const categoryMatch = (CATEGORY_LABELS[d.category] ?? d.category)
          .toLowerCase()
          .includes(q);
        if (!nameMatch && !descMatch && !categoryMatch) return false;
      }
      if (rarityFilter !== "all" && d.rarity !== rarityFilter) return false;
      if (categoryFilter !== "all" && d.category !== categoryFilter)
        return false;
      const isCustom = d.id.startsWith(CUSTOM_PREFIX);
      if (typeFilter === "built-in" && isCustom) return false;
      if (typeFilter === "custom" && !isCustom) return false;
      const pts = getPoints(d);
      if (pointsFilter !== "all") {
        const minPoints = parseInt(pointsFilter, 10);
        if (pts < minPoints) return false;
      }
      return true;
    }) ?? [];

  const sorted = [...filtered].sort((a, b) => {
    const stats = data?.stats ?? {};
    const teamCount = (id: string) => stats[id]?.count ?? 0;
    let cmp = 0;
    switch (sortKey) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "rarity":
        cmp = (RARITY_ORDER[a.rarity] ?? -1) - (RARITY_ORDER[b.rarity] ?? -1);
        break;
      case "category":
        cmp = (CATEGORY_LABELS[a.category] ?? a.category).localeCompare(
          CATEGORY_LABELS[b.category] ?? b.category,
        );
        break;
      case "points":
        cmp = getPoints(a) - getPoints(b);
        break;
      case "teams":
        cmp = teamCount(a.id) - teamCount(b.id);
        break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="size-6 text-yellow-500" />
            Achievements
          </h1>
          <p className="text-sm text-muted-foreground">
            All achievements and how many teams earned each.
          </p>
        </div>
        <AddAchievementDialog onCreated={fetchData} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:max-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search by name, description, category…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="built-in">Built-in</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rarityFilter} onValueChange={setRarityFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Rarity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rarities</SelectItem>
              {RARITIES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c] ?? c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={pointsFilter} onValueChange={setPointsFilter}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Points" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All pts</SelectItem>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="6">6</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <TooltipProvider>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Icon</TableHead>
                <SortableHead
                  label="Name"
                  sortKey="name"
                  currentSort={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <TableHead className="max-w-[200px]">Description</TableHead>
                <SortableHead
                  label="Rarity"
                  sortKey="rarity"
                  currentSort={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Category"
                  sortKey="category"
                  currentSort={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
                <SortableHead
                  label="Pts"
                  sortKey="points"
                  currentSort={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="text-right w-16"
                />
                <SortableHead
                  label="Teams"
                  sortKey="teams"
                  currentSort={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                  className="text-right w-20"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-2xl">{d.icon}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell
                    className="text-muted-foreground text-xs max-w-[200px] truncate"
                    title={d.description}
                  >
                    {d.description}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "capitalize",
                        d.rarity === "legendary" &&
                          "text-yellow-600 dark:text-yellow-400",
                      )}
                    >
                      {d.rarity}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {CATEGORY_LABELS[d.category] ?? d.category}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {getPoints(d)}
                  </TableCell>
                  <TeamsCountCell
                    achievementId={d.id}
                    stats={data?.stats ?? {}}
                  />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {searchQuery.trim()
            ? "No achievements match your search or filters."
            : "No achievements match the filters."}
        </p>
      )}
    </div>
  );
}
