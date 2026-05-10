import { describe, it, expect } from "vitest";

// ── Formatting helpers (mirrors what components use inline) ──────────────────

function fdate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmt(n: number): string {
  return n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function currencySymbol(currency: string): string {
  return currency === "ZAR" ? "R" : "$";
}

// ── Invoice calculation helpers ──────────────────────────────────────────────

type InvoiceLine = { quantity: number; unit_price: number };

function lineTotal(lines: InvoiceLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
}

function vatAmount(subtotal: number, rate = 0.15): number {
  return Math.round(subtotal * rate * 100) / 100;
}

function totalInclVat(subtotal: number, rate = 0.15): number {
  return Math.round((subtotal + vatAmount(subtotal, rate)) * 100) / 100;
}

function subtotalExclVat(totalIncl: number, rate = 0.15): number {
  return Math.round((totalIncl / (1 + rate)) * 100) / 100;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function validateOrgLogin(orgName: string, userOrgs: { id: string; name: string }[]): string | null {
  if (!orgName.trim()) return "Please enter your organisation name.";
  const match = userOrgs.find(o => o.name.toLowerCase().includes(orgName.toLowerCase().trim()));
  if (!match) return `Organisation "${orgName}" not found for this account.`;
  return null; // valid
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Completed: "var(--accent)",
  Pending: "var(--amber-c)",
  "Written Off": "var(--red-c)",
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] || "var(--muted2)";
}

function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status !== "Pending") return false;
  return new Date(dueDate) < new Date();
}

// ── KPI aggregation ───────────────────────────────────────────────────────────

type Invoice = { amount: number; status: string };

function totalCollected(invoices: Invoice[]): number {
  return invoices.filter(i => i.status === "Completed").reduce((s, i) => s + i.amount, 0);
}

function totalPending(invoices: Invoice[]): number {
  return invoices.filter(i => i.status === "Pending").reduce((s, i) => s + i.amount, 0);
}

function totalInvoiced(invoices: Invoice[]): number {
  return invoices.reduce((s, i) => s + i.amount, 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("fdate — date formatting", () => {
  it("returns — for null", () => {
    expect(fdate(null)).toBe("—");
  });

  it("formats a valid ISO date string", () => {
    const result = fdate("2025-01-15");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it("returns — for an invalid date string", () => {
    expect(fdate("not-a-date")).toBe("—");
  });
});

describe("fmt — number formatting", () => {
  it("formats zero", () => {
    expect(fmt(0)).toBe("0");
  });

  it("formats thousands", () => {
    expect(fmt(10000)).toMatch(/10/);
  });

  it("rounds decimals", () => {
    expect(fmt(1234.9)).not.toContain(".");
  });
});

describe("currencySymbol", () => {
  it("returns R for ZAR", () => {
    expect(currencySymbol("ZAR")).toBe("R");
  });

  it("returns $ for USD", () => {
    expect(currencySymbol("USD")).toBe("$");
  });

  it("returns $ for unknown currencies", () => {
    expect(currencySymbol("EUR")).toBe("$");
  });
});

describe("lineTotal — invoice line calculations", () => {
  it("returns 0 for empty lines", () => {
    expect(lineTotal([])).toBe(0);
  });

  it("multiplies quantity × unit_price for single line", () => {
    expect(lineTotal([{ quantity: 3, unit_price: 100 }])).toBe(300);
  });

  it("sums multiple lines", () => {
    expect(lineTotal([
      { quantity: 2, unit_price: 500 },
      { quantity: 1, unit_price: 200 },
    ])).toBe(1200);
  });

  it("handles fractional prices", () => {
    expect(lineTotal([{ quantity: 3, unit_price: 33.33 }])).toBeCloseTo(99.99);
  });
});

describe("VAT calculations (15%)", () => {
  it("vatAmount is 15% of subtotal", () => {
    expect(vatAmount(1000)).toBe(150);
  });

  it("totalInclVat adds VAT to subtotal", () => {
    expect(totalInclVat(1000)).toBe(1150);
  });

  it("subtotalExclVat strips VAT from inclusive total", () => {
    expect(subtotalExclVat(1150)).toBeCloseTo(1000, 1);
  });

  it("round-trips: excl → incl → excl", () => {
    const original = 850;
    const incl = totalInclVat(original);
    expect(subtotalExclVat(incl)).toBeCloseTo(original, 0);
  });

  it("supports custom VAT rate", () => {
    expect(vatAmount(1000, 0.20)).toBe(200);
  });
});

describe("validateOrgLogin", () => {
  const orgs = [
    { id: "1", name: "Coco Trading" },
    { id: "2", name: "Acme Corp" },
  ];

  it("rejects empty org name", () => {
    expect(validateOrgLogin("", orgs)).toContain("enter your organisation");
  });

  it("rejects whitespace-only org name", () => {
    expect(validateOrgLogin("   ", orgs)).toContain("enter your organisation");
  });

  it("returns null for exact match", () => {
    expect(validateOrgLogin("Coco Trading", orgs)).toBeNull();
  });

  it("returns null for partial match (case-insensitive)", () => {
    expect(validateOrgLogin("coco", orgs)).toBeNull();
  });

  it("returns error for non-matching org", () => {
    expect(validateOrgLogin("Unknown Org", orgs)).toContain("not found");
  });

  it("error message includes the attempted org name", () => {
    const err = validateOrgLogin("Ghost Inc", orgs);
    expect(err).toContain("Ghost Inc");
  });
});

describe("statusColor", () => {
  it("returns accent for Completed", () => {
    expect(statusColor("Completed")).toBe("var(--accent)");
  });

  it("returns amber for Pending", () => {
    expect(statusColor("Pending")).toBe("var(--amber-c)");
  });

  it("returns red for Written Off", () => {
    expect(statusColor("Written Off")).toBe("var(--red-c)");
  });

  it("returns muted for unknown status", () => {
    expect(statusColor("Draft")).toBe("var(--muted2)");
  });
});

describe("isOverdue", () => {
  const past = "2020-01-01";
  const future = "2099-12-31";

  it("not overdue if status is not Pending", () => {
    expect(isOverdue(past, "Completed")).toBe(false);
  });

  it("not overdue if due date is null", () => {
    expect(isOverdue(null, "Pending")).toBe(false);
  });

  it("overdue when past due and Pending", () => {
    expect(isOverdue(past, "Pending")).toBe(true);
  });

  it("not overdue when future due date and Pending", () => {
    expect(isOverdue(future, "Pending")).toBe(false);
  });
});

describe("KPI aggregations", () => {
  const invoices: Invoice[] = [
    { amount: 5000, status: "Completed" },
    { amount: 3000, status: "Completed" },
    { amount: 2000, status: "Pending" },
    { amount: 1000, status: "Written Off" },
  ];

  it("totalCollected sums only Completed invoices", () => {
    expect(totalCollected(invoices)).toBe(8000);
  });

  it("totalPending sums only Pending invoices", () => {
    expect(totalPending(invoices)).toBe(2000);
  });

  it("totalInvoiced sums all invoices", () => {
    expect(totalInvoiced(invoices)).toBe(11000);
  });

  it("handles empty invoice list", () => {
    expect(totalCollected([])).toBe(0);
    expect(totalPending([])).toBe(0);
    expect(totalInvoiced([])).toBe(0);
  });
});
