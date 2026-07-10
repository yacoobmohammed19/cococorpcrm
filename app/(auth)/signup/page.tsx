import Link from "next/link";
import { signup } from "@/server-actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; email?: string }>;
}) {
  const { invite, email } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h1 className="text-xl font-semibold">Create account</h1>
        {invite && (
          <p className="mt-2 text-sm rounded-md px-3 py-2" style={{ background: "rgba(236,72,153,0.1)", color: "var(--accent)" }}>
            You&apos;ve been invited to join a team. Create an account to accept.
          </p>
        )}
        <form action={signup} className="mt-4 space-y-3">
          {invite && <input type="hidden" name="invite" value={invite} />}
          <input
            name="email"
            type="email"
            required
            defaultValue={email || ""}
            placeholder="Email"
            className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="Password"
            className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          />
          <button className="w-full rounded-md bg-indigo-600 p-2 text-white">
            Sign up
          </button>
        </form>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Already registered? <Link href={invite ? `/login?invite=${invite}` : "/login"}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
