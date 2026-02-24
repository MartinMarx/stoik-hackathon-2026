"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import type { HackathonFeature } from "@/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FeatureForm } from "@/components/feature-form";

type StatusFilter = "all" | "draft" | "announced" | "archived";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function difficultyBadge(difficulty: HackathonFeature["difficulty"]) {
  const map: Record<
    HackathonFeature["difficulty"],
    { label: string; className: string }
  > = {
    easy: {
      label: "Easy",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    medium: {
      label: "Medium",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    hard: {
      label: "Hard",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
  };
  const { label, className } = map[difficulty];
  return <Badge className={className}>{label}</Badge>;
}

function statusBadge(status: HackathonFeature["status"]) {
  const map: Record<
    HackathonFeature["status"],
    { label: string; variant: "default" | "secondary" | "outline" }
  > = {
    draft: { label: "Draft", variant: "secondary" },
    announced: { label: "Announced", variant: "default" },
    archived: { label: "Archived", variant: "outline" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeaturesPage() {
  const [features, setFeatures] = useState<HackathonFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<
    HackathonFeature | undefined
  >();

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<HackathonFeature | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  // Announce loading
  const [announcingId, setAnnouncingId] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchFeatures = useCallback(async () => {
    try {
      const res = await fetch("/api/features");
      if (!res.ok) throw new Error("Failed to load features");
      const data: HackathonFeature[] = await res.json();
      setFeatures(data);
    } catch (err) {
      toast.error("Failed to load features", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  async function handleSave(formData: any) {
    try {
      if (editingFeature) {
        // PATCH existing
        const res = await fetch(`/api/features/${editingFeature.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to update feature");
        toast.success("Feature updated");
      } else {
        // POST new
        const res = await fetch("/api/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error("Failed to create feature");
        toast.success("Feature created");
      }

      setFormOpen(false);
      setEditingFeature(undefined);
      await fetchFeatures();
    } catch (err) {
      toast.error(editingFeature ? "Update failed" : "Creation failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    }
  }

  async function handleAnnounce(feature: HackathonFeature) {
    setAnnouncingId(feature.id);
    try {
      const res = await fetch(`/api/features/${feature.id}/announce`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to announce feature");
      const resent = feature.status === "announced";
      toast.success(resent ? "Announcement re-sent" : "Feature announced", {
        description: resent
          ? `"${feature.title}" announcement was re-sent to Slack.`
          : `"${feature.title}" has been announced.`,
      });
      await fetchFeatures();
    } catch (err) {
      toast.error("Announce failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setAnnouncingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/features/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete feature");
      toast.success("Feature deleted", {
        description: `"${deleteTarget.title}" has been removed.`,
      });
      setDeleteTarget(null);
      await fetchFeatures();
    } catch (err) {
      toast.error("Delete failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setDeleting(false);
    }
  }

  // -----------------------------------------------------------------------
  // Filtered data
  // -----------------------------------------------------------------------

  const filtered =
    filter === "all" ? features : features.filter((f) => f.status === filter);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Features</h1>
          <p className="text-sm text-muted-foreground">
            Manage hackathon features and acceptance criteria.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingFeature(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          New Feature
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {features.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {features.filter((f) => f.status === "draft").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="announced">
            Announced
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {features.filter((f) => f.status === "announced").length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
              {features.filter((f) => f.status === "archived").length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* We render a single TabsContent for all tabs and filter manually */}
        <TabsContent value={filter} className="mt-4">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              isFiltered={filter !== "all"}
              onCreateClick={() => {
                setEditingFeature(undefined);
                setFormOpen(true);
              }}
            />
          ) : (
            <FeaturesTable
              features={filtered}
              announcingId={announcingId}
              onEdit={(f) => {
                setEditingFeature(f);
                setFormOpen(true);
              }}
              onAnnounce={handleAnnounce}
              onDelete={setDeleteTarget}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Create / Edit dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingFeature(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFeature ? "Edit Feature" : "New Feature"}
            </DialogTitle>
            <DialogDescription>
              {editingFeature
                ? "Update this feature's details and criteria."
                : "Create a new hackathon feature for teams to implement."}
            </DialogDescription>
          </DialogHeader>
          <FeatureForm
            feature={editingFeature}
            onSave={handleSave}
            onCancel={() => {
              setFormOpen(false);
              setEditingFeature(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Feature</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                &ldquo;{deleteTarget?.title}&rdquo;
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FeaturesTable({
  features,
  announcingId,
  onEdit,
  onAnnounce,
  onDelete,
}: {
  features: HackathonFeature[];
  announcingId: string | null;
  onEdit: (f: HackathonFeature) => void;
  onAnnounce: (f: HackathonFeature) => void;
  onDelete: (f: HackathonFeature) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Points</TableHead>
          <TableHead>Difficulty</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Criteria</TableHead>
          <TableHead className="text-center">Teams achieved</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {features.map((feature) => (
          <TableRow key={feature.id}>
            <TableCell className="font-medium max-w-[240px] truncate">
              {feature.title}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{feature.points} pts</Badge>
            </TableCell>
            <TableCell>{difficultyBadge(feature.difficulty)}</TableCell>
            <TableCell>
              {feature.status === "announced" && feature.announcedAt ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>{statusBadge(feature.status)}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Announced on{" "}
                      {new Date(feature.announcedAt).toLocaleDateString(
                        undefined,
                        { dateStyle: "long" },
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                statusBadge(feature.status)
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default underline decoration-dotted underline-offset-2">
                      {feature.criteria.length}{" "}
                      {feature.criteria.length === 1 ? "criterion" : "criteria"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <ul className="list-inside list-decimal space-y-1 text-left">
                      {feature.criteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell className="text-center text-muted-foreground">
              {(feature.teamsAchievedNames?.length ?? 0) > 0 ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default underline decoration-dotted underline-offset-2">
                        {feature.teamsAchievedCount ?? 0}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <ul className="list-inside list-disc space-y-0.5 text-left">
                        {feature.teamsAchievedNames!.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                (feature.teamsAchievedCount ?? 0)
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onEdit(feature)}
                  title="Edit"
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onAnnounce(feature)}
                  disabled={
                    feature.status === "archived" || announcingId === feature.id
                  }
                  title={
                    feature.status === "announced"
                      ? "Re-send announcement"
                      : "Announce"
                  }
                >
                  {announcingId === feature.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : feature.status === "announced" ? (
                    <RefreshCw className="size-3" />
                  ) : (
                    <Megaphone className="size-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDelete(feature)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-[200px]" />
          <Skeleton className="h-5 w-[60px]" />
          <Skeleton className="h-5 w-[70px]" />
          <Skeleton className="h-5 w-[80px]" />
          <Skeleton className="h-5 w-[70px]" />
          <Skeleton className="h-5 w-[50px]" />
          <Skeleton className="ml-auto h-5 w-[80px]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  isFiltered,
  onCreateClick,
}: {
  isFiltered: boolean;
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <Sparkles className="size-10 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium">
        {isFiltered ? "No features match this filter" : "No features yet"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {isFiltered
          ? "Try selecting a different status tab."
          : "Create your first feature!"}
      </p>
      {!isFiltered && (
        <Button className="mt-4" onClick={onCreateClick}>
          <Plus className="size-4" />
          New Feature
        </Button>
      )}
    </div>
  );
}
