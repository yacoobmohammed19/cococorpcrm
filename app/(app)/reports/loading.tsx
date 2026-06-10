export default function Loading() {
  return (
    <section>
      <div className="mb-6">
        <div className="h-7 w-32 rounded-lg animate-pulse" style={{ background: "var(--card2)" }} />
        <div className="h-4 w-72 rounded mt-1.5 animate-pulse" style={{ background: "var(--card2)" }} />
      </div>
      <div className="rounded-2xl animate-pulse" style={{ background: "var(--card)", border: "1px solid var(--border)", height: 480 }} />
    </section>
  );
}
