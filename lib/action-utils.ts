// Detect Postgres foreign-key constraint violation (error code 23503)
export function isFKViolation(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err).toLowerCase();
  return msg.includes("23503") || msg.includes("foreign key") || (msg.includes("violates") && msg.includes("constraint"));
}

// Friendly message for FK violations
export function fkErrorMessage(): string {
  return "Cannot delete this record as it is currently in use by other data.";
}

// Wrap a server-action call with success/error toasts.
// Pass the toast context and an optional FK-friendly override.
export async function runAction(
  fn: () => Promise<unknown>,
  toast: { success: (m: string) => void; error: (m: string) => void },
  successMsg: string,
  errorMsg?: string,
): Promise<boolean> {
  try {
    await fn();
    toast.success(successMsg);
    return true;
  } catch (err) {
    if (isFKViolation(err)) {
      toast.error(fkErrorMessage());
    } else {
      toast.error(errorMsg ?? "Something went wrong. Please try again.");
    }
    return false;
  }
}
