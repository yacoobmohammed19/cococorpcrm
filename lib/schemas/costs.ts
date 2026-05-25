import { z } from "zod";

export const COST_TYPES = [
  { value: "operational", label: "Operational" },
  { value: "sadaqah",     label: "Sadaqah" },
  { value: "zakat",       label: "Zakat" },
  { value: "owner_draw",  label: "Owner's Draw" },
  { value: "capex",       label: "CapEx" },
  { value: "personal",    label: "Personal" },
] as const;

export type CostTypeValue = (typeof COST_TYPES)[number]["value"];

export const CostSchema = z.object({
  org_id: z.string().uuid(),
  transaction_date: z.string().min(1),
  cost_details: z.string().optional(),
  cost_category_id: z.coerce.number().optional().nullable(),
  amount: z.coerce.number().min(0),
  account_id: z.coerce.number().optional().nullable(),
  customer_id: z.coerce.number().optional().nullable(),
  recouped: z.string().optional().default(""),
  receipt_image_url: z.string().optional().nullable(),
  apportion_to_customers: z.coerce.boolean().default(false),
  cost_type: z.enum(["operational", "sadaqah", "zakat", "owner_draw", "capex", "personal"]).default("operational"),
  include_in_pnl: z.coerce.boolean().default(true),
});

export const CashflowSchema = z.object({
  org_id: z.string().uuid(),
  record_date: z.string().min(1),
  account_id: z.coerce.number(),
  balance: z.coerce.number(),
  notes: z.string().optional(),
});

export type CostInput = z.infer<typeof CostSchema>;
export type CashflowInput = z.infer<typeof CashflowSchema>;
