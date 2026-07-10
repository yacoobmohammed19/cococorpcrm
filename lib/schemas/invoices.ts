import { z } from "zod";

export const InvoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive().default(1),
  unit_price: z.coerce.number().nonnegative(),
  position: z.coerce.number().int().nonnegative().default(0),
});

export const InvoiceSchema = z.object({
  org_id: z.string().uuid(),
  customer_id: z.coerce.number().int().positive(),
  transaction_date: z.string().min(1),
  invoice_number: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().nonnegative(),
  status: z.string().min(1).default("Pending"),
  due_date: z.string().optional(),
});

export type InvoiceInput = z.infer<typeof InvoiceSchema>;
export type InvoiceLineInput = z.infer<typeof InvoiceLineSchema>;
