"use client";

import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VoteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  isChange?: boolean;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function VoteConfirmationDialog({
  open,
  onOpenChange,
  teamName,
  isChange = false,
  onConfirm,
  isLoading = false,
}: VoteConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isLoading} className="z-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isChange ? `Change your vote to ${teamName}?` : `Vote for ${teamName}?`}
          </DialogTitle>
          <DialogDescription>
            {isChange
              ? "Your previous vote will be replaced."
              : "You can change your vote later if you want."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Confirm vote"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
