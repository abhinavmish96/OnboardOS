"use client";

import { useState } from "react";
import type { Approval, Document } from "@contract/contract";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS: Record<Document["status"], { label: string; cls: string }> = {
  generating: { label: "Generating", cls: "bg-muted text-muted-foreground" },
  in_compliance_review: { label: "Compliance review", cls: "bg-sky-100 text-sky-800" },
  awaiting_approval: { label: "Awaiting approval", cls: "bg-amber-100 text-amber-900" },
  changes_requested: { label: "Changes requested", cls: "bg-rose-100 text-rose-800" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
};

export function DocumentCard({
  doc,
  approvals,
  onReview,
}: {
  doc: Document;
  approvals: Approval[];
  onReview: (doc: Document) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? doc.currentVersion;
  const v = doc.versions.find((x) => x.version === shown);
  const prev = doc.versions.find((x) => x.version === shown - 1);
  const decision = approvals.filter((a) => a.documentId === doc.id && a.version === shown).at(-1);
  const status = STATUS[doc.status];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{doc.title}</CardTitle>
        <CardDescription>
          {doc.currentVersion ? `Current version ${doc.currentVersion}` : "Not generated yet"}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Badge variant="secondary" className={status.cls}>
            {status.label}
          </Badge>
          {doc.status === "awaiting_approval" && (
            <Button size="sm" onClick={() => onReview(doc)}>
              Review v{doc.currentVersion}
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {doc.versions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {doc.versions.map((x) => (
              <Button
                key={x.version}
                size="sm"
                variant={x.version === shown ? "default" : "outline"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setPicked(x.version === doc.currentVersion ? null : x.version)}
              >
                v{x.version}
                {x.version < doc.currentVersion && " · superseded"}
              </Button>
            ))}
          </div>
        )}

        {!v ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" /> Document Agent is drafting…
          </p>
        ) : (
          <>
            {v.reason && <p className="text-sm text-muted-foreground">{v.reason}</p>}
            {decision && (
              <Alert
                className={cn(
                  decision.decision === "approved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-rose-200 bg-rose-50 text-rose-900",
                )}
              >
                <AlertTitle>
                  v{decision.version} {decision.decision === "approved" ? "approved" : "changes requested"} by{" "}
                  {decision.reviewer}
                </AlertTitle>
                {decision.comment && <AlertDescription className="italic">“{decision.comment}”</AlertDescription>}
              </Alert>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.rows.map((row, i) => {
                  const before = prev?.rows[i];
                  const changed = before && (before.debit !== row.debit || before.credit !== row.credit);
                  return (
                    <TableRow key={row.ruleId + i} className={cn(changed && "bg-emerald-50 hover:bg-emerald-50")}>
                      <TableCell className="font-medium">{row.scenario}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.ruleId}</TableCell>
                      <TableCell>
                        {changed && before.debit !== row.debit && (
                          <s className="mr-1 text-rose-500">{before.debit}</s>
                        )}
                        {row.debit}
                      </TableCell>
                      <TableCell>
                        {changed && before.credit !== row.credit && (
                          <s className="mr-1 text-rose-500">{before.credit}</s>
                        )}
                        {row.credit}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">{row.note}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {v.complianceFindings.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Compliance Agent (simulated):</span>{" "}
                {v.complianceFindings.join(" · ")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
