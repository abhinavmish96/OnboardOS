/**
 * SpookyStream seed data — copied from web/src/server/seed.ts to keep the backend
 * self-contained. Same fictional accounting rules and mapping rows.
 */

import type { BusinessRequirements, MappingRow } from "./contract.js";

export const SPOOKYSTREAM: BusinessRequirements = {
  company: "SpookyStream",
  product: "Monthly streaming subscription",
  priceUsd: 12.99,
  billingInterval: "month",
  refundPolicy:
    "Full refund within 7 days of a charge if fewer than 2 hours were streamed; otherwise no refund.",
  launchDate: "2026-11-15",
};

export const FINANCE_RULES = [
  { ruleId: "ACR-1001", scenario: "New subscription charge" },
  { ruleId: "ACR-1002", scenario: "Monthly revenue recognition" },
  { ruleId: "ACR-1003", scenario: "Refund within 7 days" },
  { ruleId: "ACR-1004", scenario: "Failed payment retry" },
];

export const ACCOUNTING_CONFIGURATION: MappingRow[] = [
  { scenario: "Billing plan", ruleId: "CFG-01", debit: "—", credit: "—", note: "$12.99 / month, billed in advance" },
  { scenario: "Revenue schedule", ruleId: "CFG-02", debit: "—", credit: "—", note: "Ratable over the 1-month service period" },
  { scenario: "Refund window", ruleId: "CFG-03", debit: "—", credit: "—", note: "7 days, under 2 streamed hours" },
  { scenario: "Tax handling", ruleId: "CFG-04", debit: "—", credit: "—", note: "Tax collected separately, excluded from revenue" },
];

export const LEDGER_MAPPING_V1: MappingRow[] = [
  { scenario: "New subscription charge", ruleId: "ACR-1001", debit: "Cash", credit: "Deferred revenue" },
  { scenario: "Monthly revenue recognition", ruleId: "ACR-1002", debit: "Deferred revenue", credit: "Subscription revenue" },
  { scenario: "Refund within 7 days", ruleId: "ACR-1003", debit: "Refund expense", credit: "Subscription revenue", note: "Books the refund as new revenue" },
  { scenario: "Failed payment retry", ruleId: "ACR-1004", debit: "Accounts receivable", credit: "Deferred revenue" },
];

export const LEDGER_MAPPING_V2: MappingRow[] = [
  LEDGER_MAPPING_V1[0],
  LEDGER_MAPPING_V1[1],
  { scenario: "Refund within 7 days", ruleId: "ACR-1003", debit: "Deferred revenue", credit: "Cash", note: "Reverses the deferred revenue from the charge" },
  LEDGER_MAPPING_V1[3],
];
