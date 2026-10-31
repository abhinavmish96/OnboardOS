"use client";

import { useMemo, useState } from "react";
import type { Decision, Document } from "@contract/contract";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const SUGGESTED = "Refund transactions must reverse deferred revenue, not recognize new revenue.";

export function ReviewModal({
  doc,
  onClose,
  onSubmit,
}: {
  doc: Document;
  onClose: () => void;
  onSubmit: (decision: Decision, comment: string, operationId: string) => Promise<void>;
}) {
  // One operation id per open dialog: a double click sends the same decision once.
  const operationId = useMemo(() => crypto.randomUUID(), []);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: Decision) {
    if (decision === "rejected" && !comment.trim()) {
      setError("Say what needs to change so the agents can correct it.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      await onSubmit(decision, comment.trim(), operationId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Review {doc.title} · v{doc.currentVersion}
          </DialogTitle>
          <DialogDescription>
            Your decision applies to version {doc.currentVersion} only. A revision needs a new approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="comment">
            Comment
          </label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Required when requesting changes"
          />
          {doc.id === "ledger_mapping" && doc.currentVersion === 1 && !comment && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setComment(SUGGESTED)}>
              Use: “{SUGGESTED}”
            </Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            disabled={busy !== null}
            onClick={() => submit("rejected")}
          >
            {busy === "rejected" ? "Sending…" : "Request changes"}
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={busy !== null}
            onClick={() => submit("approved")}
          >
            {busy === "approved" ? "Approving…" : `Approve v${doc.currentVersion}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
