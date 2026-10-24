"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { switchBrand } from "./brand-actions";
import { cn } from "@/components/ui/cn";
import { initials } from "@/lib/sheet";

const NAV = [
  { href: "/admin/links", label: "Responses" },
  { href: "/admin/brand", label: "Brand" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/memory", label: "Brain" },
  { href: "/admin/training", label: "Training" },
  { href: "/admin/portals", label: "Portals" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/settings", label: "Settings" },
];

type BrandItem = { id: string; name: string };

function BrandMenu({
  brands, activeId, brandName, hasLogo, compact, locked,
}: { brands: BrandItem[]; activeId: string | null; brandName: string; hasLogo: boolean; compact?: boolean; locked?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  function toggle() {
    if (!open && btn.current) {
      const r = btn.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
    }
    setOpen(!open);
  }
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
    const down = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  function onKey(e: React.KeyboardEvent) {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") setOpen(false);
  }

  const mark = hasLogo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/admin/brand/logo" alt="" className="size-[30px] flex-none rounded border border-rule object-contain" />
  ) : (
    <span className="grid size-[30px] flex-none place-items-center rounded bg-ink text-[11px] font-bold tracking-[0.02em] text-white">{initials(brandName)}</span>
  );

  // Focused on one brand (Settings): show it plainly, no switcher.
  if (locked) {
    return (
      <div className={compact ? "mr-2 flex-none min-[861px]:hidden" : "mx-1 mb-8 hidden min-[861px]:block"}>
        <div className={cn("flex items-center gap-2.5", compact ? "px-1.5 py-1" : "w-full px-1.5 py-1.5")}>
          {!compact && mark}
          <span className="min-w-0 flex-1 leading-tight">
            <span className={cn("block truncate font-semibold text-ink", compact ? "max-w-[10rem] text-sm" : "text-sm")}>{brandName}</span>
            {!compact && <span className="block text-[11px] tracking-[0.08em] text-ink-3">REVIEW ASSIST</span>}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "mr-2 flex-none min-[861px]:hidden" : "mx-1 mb-8 hidden min-[861px]:block"}>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Brand: ${brandName}. Switch brand`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            toggle();
          }
        }}
        className={cn(
          "flex items-center gap-2.5 rounded text-left transition-colors hover:bg-surface",
          compact ? "px-1.5 py-1" : "w-full px-1.5 py-1.5",
        )}
      >
        {!compact && mark}
        <span className="min-w-0 flex-1 leading-tight">
          <span className={cn("block truncate font-semibold text-ink", compact ? "max-w-[10rem] text-sm" : "text-sm")}>{brandName}</span>
          {!compact && <span className="block text-[11px] tracking-[0.08em] text-ink-3">REVIEW ASSIST</span>}
        </span>
        <ChevronsUpDown size={14} aria-hidden className="flex-none text-ink-3" />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Brands"
          onKeyDown={onKey}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-60 rounded border border-ink bg-white p-1"
        >
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              role="menuitemradio"
              aria-checked={b.id === activeId}
              disabled={busy}
              onClick={async () => {
                if (b.id === activeId) return setOpen(false);
                setBusy(true);
                try {
                  await switchBrand(b.id);
                } finally {
                  setBusy(false);
                  setOpen(false);
                }
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm hover:bg-surface focus:bg-surface focus:outline-none"
            >
              <span className="min-w-0 flex-1 truncate">{b.name || "Untitled brand"}</span>
              {b.id === activeId && <Check size={14} aria-hidden className="flex-none" />}
            </button>
          ))}
          <div className="my-1 border-t border-rule" />
          <Link
            href="/admin/onboarding"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded px-2.5 py-2 text-sm font-medium text-carbon hover:bg-surface focus:bg-surface focus:outline-none"
          >
            <Plus size={14} aria-hidden /> New brand
          </Link>
        </div>
      )}
    </div>
  );
}

export function AdminShell({
  logout,
  brandName,
  hasLogo,
  brands,
  activeId,
  locked = false,
  children,
}: {
  logout: () => Promise<void>;
  brandName: string;
  hasLogo: boolean;
  brands: BrandItem[];
  activeId: string | null;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  const needsOnboarding = brands.length === 0 && !pathname.startsWith("/admin/onboarding");

  return (
    <div className="grid min-h-screen grid-cols-1 grid-rows-[auto_1fr] min-[861px]:grid-cols-[220px_1fr] min-[861px]:grid-rows-1">
      <aside className="flex flex-row items-center gap-px overflow-x-auto border-b border-rule px-4 py-2.5 min-[861px]:sticky min-[861px]:top-0 min-[861px]:h-screen min-[861px]:flex-col min-[861px]:items-stretch min-[861px]:overflow-visible min-[861px]:border-b-0 min-[861px]:border-r min-[861px]:px-3 min-[861px]:py-6">
        <BrandMenu brands={brands} activeId={activeId} brandName={brandName} hasLogo={hasLogo} locked={locked} compact />
        <BrandMenu brands={brands} activeId={activeId} brandName={brandName} hasLogo={hasLogo} locked={locked} />
        <nav aria-label="Admin" className="flex gap-px min-[861px]:flex-col">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded px-2.5 py-2 font-medium transition-colors",
                  active ? "bg-ink text-white" : "text-ink-2 hover:bg-surface hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <form action={logout} className="ml-auto flex-none min-[861px]:mt-auto min-[861px]:ml-0">
          <button
            type="submit"
            className="flex w-full items-center gap-2 whitespace-nowrap rounded px-2.5 py-2 text-[13px] font-medium text-ink-3 transition-colors hover:bg-surface hover:text-ink"
          >
            <LogOut size={14} aria-hidden /> Log out
          </button>
        </form>
      </aside>
      <main className="min-w-0 px-4 pb-[60px] pt-7 min-[861px]:px-12 min-[861px]:pb-20 min-[861px]:pt-11">
        <div className="max-w-[1040px]">
          {needsOnboarding ? (
            <div className="max-w-[520px]">
              <h1 className="text-[clamp(34px,4.2vw,44px)] font-bold leading-[1.03] tracking-[-0.035em]">Add your first brand</h1>
              <p className="mt-2.5 text-base text-ink-2">Review Assist needs a brand before you can make links.</p>
              <Link href="/admin/onboarding" className="mt-6 inline-flex h-[42px] items-center rounded bg-carbon px-[18px] font-semibold text-white hover:bg-carbon-deep">
                Start setup
              </Link>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
