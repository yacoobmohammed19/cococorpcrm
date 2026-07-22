import { z } from "zod";

export const INCOME_TYPES = [
  { value: "asset_sale", label: "Asset Sale" },
  { value: "interest",   label: "Interest" },
  { value: "refund",     label: "Refund / Rebate" },
  { value: "other",      label: "Other Income" },
] as const;

export type IncomeTypeValue = (typeof INCOME_TYPES)[number]["value"];

export const INCOME_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  INCOME_TYPES.map((t) => [t.value, t.label]),
);

export const IncomeSchema = z.object({
  org_id: z.string().uuid(),
  transaction_date: z.string().min(1),
  amount: z.coerce.number().min(0),
  description: z.string().optional().nullable(),
  income_type: z.enum(["asset_sale", "interest", "refund", "other"]).default("other"),
  account_id: z.coerce.number().optional().nullable(),
  reference: z.string().optional().nullable(),
});

export type IncomeInput = z.infer<typeof IncomeSchema>;
