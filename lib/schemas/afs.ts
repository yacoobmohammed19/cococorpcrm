import { z } from "zod";

export const STATEMENTS = [
  "balance_sheet",
  "income_statement",
  "changes_in_equity",
  "cash_flow",
  "notes",
] as const;

export const AfsLineSchema = z.object({
  fin_year: z.coerce.number().int(),
  statement: z.enum(STATEMENTS),
  section: z.string().min(1),
  line_key: z.string().optional().nullable(),
  label: z.string().min(1),
  amount: z.coerce.number(),
  is_custom: z.coerce.boolean().default(false),
  sort: z.coerce.number().int().default(0),
  note: z.string().optional().nullable(),
});

export type AfsLineInput = z.infer<typeof AfsLineSchema>;
