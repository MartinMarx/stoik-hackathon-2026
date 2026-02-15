"use client";

import { useState, useEffect } from "react";
import { Loader2, Plus, Sparkles, X, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { HackathonFeature } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FeatureFormProps {
  feature?: HackathonFeature;
  onSave: (feature: any) => void;
  onCancel: () => void;
}

export function FeatureForm({ feature, onSave, onCancel }: FeatureFormProps) {
  const [title, setTitle] = useState(feature?.title ?? "");
  const [description, setDescription] = useState(feature?.description ?? "");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    feature?.difficulty ?? "medium",
  );
  const [points, setPoints] = useState<number>(feature?.points ?? 10);
  const [criteria, setCriteria] = useState<string[]>(
    feature?.criteria?.length ? feature.criteria : [""],
  );
  const [assisting, setAssisting] = useState(false);

  // Quick create mode: just a single prompt field
  const [quickPrompt, setQuickPrompt] = useState("");
  const [isQuickMode, setIsQuickMode] = useState(!feature); // Default to quick mode for new features

  useEffect(() => {
    if (feature) {
      setTitle(feature.title);
      setDescription(feature.description);
      setDifficulty(feature.difficulty);
      setPoints(feature.points);
      setCriteria(feature.criteria.length ? feature.criteria : [""]);
      setIsQuickMode(false); // Edit mode is always full mode
    }
  }, [feature]);

  function addCriterion() {
    setCriteria((prev) => [...prev, ""]);
  }

  function removeCriterion(index: number) {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCriterion(index: number, value: string) {
    setCriteria((prev) => prev.map((c, i) => (i === index ? value : c)));
  }

  async function handleAssist(prompt?: string) {
    const input = prompt || quickPrompt || title || description;
    if (!input?.trim()) {
      toast.error("Type something first — even a single sentence works!");
      return;
    }

    setAssisting(true);
    try {
      const res = await fetch("/api/features/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });

      if (!res.ok) throw new Error("AI assist failed");

      const data = await res.json();

      if (data.suggestedTitle) setTitle(data.suggestedTitle);
      if (data.polishedDescription) setDescription(data.polishedDescription);
      if (data.criteria?.length) setCriteria(data.criteria);
      if (data.suggestedPoints) setPoints(data.suggestedPoints);
      if (data.suggestedDifficulty) setDifficulty(data.suggestedDifficulty);

      // Switch to full mode to show the generated content
      setIsQuickMode(false);
      setQuickPrompt("");

      toast.success("Feature generated!", {
        description: "Review and adjust before saving.",
      });
    } catch (err) {
      toast.error("AI assist failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setAssisting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    const nonEmptyCriteria = criteria.filter((c) => c.trim());

    onSave({
      title: title.trim(),
      description: description.trim(),
      difficulty,
      points,
      criteria: nonEmptyCriteria,
    });
  }

  // ── Quick create mode ──────────────────────────────────────────────────────

  if (isQuickMode) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Describe your feature idea
          </label>
          <Textarea
            placeholder='e.g. "Add a spectator mode where eliminated players can watch the game" or just "dark mode"'
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAssist();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Type anything — a single word, a sentence, or a detailed idea. AI
            will generate the full feature with title, description, criteria,
            points, and difficulty.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsQuickMode(false)}
            className="text-muted-foreground"
          >
            Fill manually instead
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleAssist()}
              disabled={assisting || !quickPrompt.trim()}
            >
              {assisting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {assisting ? "Generating..." : "Generate Feature"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Full edit mode ─────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="feature-title">
          Title
        </label>
        <Input
          id="feature-title"
          placeholder="Feature title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="feature-description">
            Description
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleAssist(title + " " + description)}
            disabled={assisting}
          >
            {assisting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Regenerate with AI
          </Button>
        </div>
        <Textarea
          id="feature-description"
          placeholder="Describe what this feature requires..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          required
        />
      </div>

      {/* Difficulty & Points */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Difficulty</label>
          <Select
            value={difficulty}
            onValueChange={(v) =>
              setDifficulty(v as "easy" | "medium" | "hard")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Easy
                </Badge>
              </SelectItem>
              <SelectItem value="medium">
                <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Medium
                </Badge>
              </SelectItem>
              <SelectItem value="hard">
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Hard
                </Badge>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="feature-points">
            Points
          </label>
          <Input
            id="feature-points"
            type="number"
            min={1}
            max={100}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Criteria */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Acceptance Criteria</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCriterion}
          >
            <Plus className="size-3" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {criteria.map((criterion, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={`Criterion ${index + 1}`}
                value={criterion}
                onChange={(e) => updateCriterion(index, e.target.value)}
              />
              {criteria.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCriterion(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {feature ? "Save Changes" : "Create Feature"}
        </Button>
      </div>
    </form>
  );
}
