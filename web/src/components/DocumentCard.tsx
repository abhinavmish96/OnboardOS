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
  in_compliance_review: { label: "Compliance review", cls: "bg-teal text-ink" },
  awaiting_approval: { label: "Awaiting approval", cls: "bg-peach text-ink" },
  changes_requested: { label: "Changes requested", cls: "bg-clay/15 text-danger" },
  approved: { label: "Approved", cls: "bg-sage/70 text-ink" },
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
  // A configuration has settings, not journal entries: no debit and credit columns.
  const entries = v?.rows.some((r) => r.debit !== "—" || r.credit !== "—") ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-medium">{doc.title}</CardTitle>
        <CardDescription className="font-mono text-xs uppercase tracking-wider">
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
            <span className="h-2 w-2 animate-pulse rounded-full bg-terracotta" /> Document Agent is drafting…
          </p>
        ) : (
          <>
            {v.reason && <p className="text-sm text-muted-foreground">{v.reason}</p>}
            {decision && (
              <Alert
                className={cn(
                  decision.decision === "approved"
                    ? "border-sage bg-sage/40 text-ink"
                    : "border-clay/30 bg-clay/10 text-ink",
                )}
              >
                <AlertTitle>
                  v{decision.version} {decision.decision === "approved" ? "approved" : "changes requested"} by{" "}
                  {decision.reviewer}
                </AlertTitle>
                {decision.comment && <AlertDescription className="italic">“{decision.comment}”</AlertDescription>}
              </Alert>
            )}
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[38%]">{entries ? "Scenario" : "Setting"}</TableHead>
                  <TableHead className="hidden w-[17%] sm:table-cell">Rule</TableHead>
                  {entries ? (
                    <>
                      <TableHead>Debit</TableHead>
                      <TableHead>Credit</TableHead>
                    </>
                  ) : (
                    <TableHead>Value</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.rows.map((row, i) => {
                  const before = prev?.rows[i];
                  const debitChanged = before && before.debit !== row.debit;
                  const creditChanged = before && before.credit !== row.credit;
                  return (
                    <TableRow
                      key={row.ruleId + i}
                      className={cn((debitChanged || creditChanged) && "bg-sage/30 hover:bg-sage/30")}
                    >
                      <TableCell className="align-top whitespace-normal">
                        <span className="font-medium">{row.scenario}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground sm:hidden">{row.ruleId}</span>
                        {entries && row.note && (
                          <span className="block text-xs text-muted-foreground">{row.note}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden align-top font-mono text-xs text-muted-foreground sm:table-cell">{row.ruleId}</TableCell>
                      {entries ? (
                        <>
                          <TableCell className="align-top whitespace-normal">
                            {debitChanged && <s className="block text-danger">{before.debit}</s>}
                            {row.debit}
                          </TableCell>
                          <TableCell className="align-top whitespace-normal">
                            {creditChanged && <s className="block text-danger">{before.credit}</s>}
                            {row.credit}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="align-top whitespace-normal">{row.note}</TableCell>
                      )}
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
