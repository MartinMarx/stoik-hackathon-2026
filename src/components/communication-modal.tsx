"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function CommunicationModal({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sendingLeaderboard, setSendingLeaderboard] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

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

  async function handleAiFix() {
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Enter some text to polish.");
      return;
    }
    setPolishing(true);
    try {
      const res = await fetch("/api/slack/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Polish failed");
      }
      const data = (await res.json()) as { polished: string };
      setMessage(data.polished ?? trimmed);
      toast.success("Text updated", {
        description: "AI has polished your message.",
      });
    } catch (err) {
      toast.error("AI fix failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setPolishing(false);
    }
  }

  async function handleSendAnnouncement() {
    const trimmed = message.trim();
    if (!trimmed) return;
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
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to send");
      }
      toast.success("Announcement sent", {
        description: "Message posted to Slack.",
      });
      setMessage("");
    } catch (err) {
      toast.error("Send failed", {
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      setSendingAnnouncement(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Communication</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Send leaderboard</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={sendingLeaderboard}
              onClick={handleSendLeaderboard}
            >
              {sendingLeaderboard ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trophy className="size-4" />
              )}
              Send Leaderboard to Slack
            </Button>
          </div>
          <div className="space-y-2">
            <label htmlFor="comm-announcement" className="text-sm font-medium">
              Custom announcement
            </label>
            <Textarea
              id="comm-announcement"
              placeholder="Type your announcement..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sendingAnnouncement}
              rows={4}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={polishing || !message.trim()}
                onClick={handleAiFix}
              >
                {polishing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                AI fix
              </Button>
              <Button
                size="sm"
                disabled={sendingAnnouncement || !message.trim()}
                onClick={handleSendAnnouncement}
              >
                {sendingAnnouncement ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
