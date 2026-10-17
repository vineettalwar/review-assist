import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-90">
        <div className="mb-8 flex items-center gap-2.5 text-sm font-semibold">
          <div className="grid size-6.5 place-items-center rounded bg-ink text-[11px] font-bold text-white">R</div>
          Review Assist
        </div>
        <p className="mb-2 font-mono text-[13px] text-ink-3">404</p>
        <h1 className="mb-3 text-4xl tracking-[-0.035em]">This page isn’t here</h1>
        <p className="mb-8 text-sm text-ink-2">The link may be old, or the page was moved.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="inline-flex h-10.5 items-center rounded bg-carbon px-4 text-sm font-medium text-white hover:bg-carbon-deep"
          >
            Go to admin
          </Link>
          <Link
            href="/"
            className="inline-flex h-10.5 items-center rounded border border-rule px-4 text-sm font-medium text-ink hover:border-rule-strong"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
