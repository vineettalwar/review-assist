// Shown the instant a nav link is clicked, so switching pages never looks stuck while the server renders.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-2 h-8 w-48 rounded bg-surface" />
      <div className="mb-10 h-4 w-96 max-w-full rounded bg-surface" />
      <div className="grid gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-surface" />)}
      </div>
    </div>
  );
}
