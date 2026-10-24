import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, portals } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { isLockedType, canIncentivize } from "@/lib/compliance";
import { Card, Icons, Note, PageHeader, Pill, buttonClass, Button } from "@/components/ui";
import { ActionToggle } from "@/components/ui/ActionToggle";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PortalForm } from "./PortalForm";
import { deletePortal, movePortal, setPortalDefault, setPortalIncentives } from "./actions";

export default async function PortalsPage({ searchParams }: { searchParams: Promise<{ new?: string; edit?: string }> }) {
  const sp = await searchParams;
  const b = await getActiveBrand();
  if (!b) redirect("/admin/onboarding");
  const db = await getDb();
  const rows = (await db.select().from(portals).where(eq(portals.brandId, b.id))).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  const mainId = rows.find((p) => p.isDefault)?.id;
  const editing = sp.edit ? rows.find((p) => p.id === sp.edit) : undefined;

  return (
    <>
      <PageHeader
        title="Portals"
        description="The first default is the main button."
        action={<Link href="/admin/portals?new=1" className={buttonClass("primary")}><Icons.Plus size={16} aria-hidden />Add portal</Link>}
      />
      <Note icon={<Icons.Lock size={16} aria-hidden />}>
        <b>Google, Amazon, Trustpilot, Yelp and Facebook don&apos;t allow rewards for reviews.</b> Rewards stay off for them and can&apos;t be turned on, so your listing is never at risk.
      </Note>

      {sp.new && !editing && <PortalForm key="new" />}
      {editing && <PortalForm key={editing.id} initial={{ id: editing.id, type: editing.type, label: editing.label, url: editing.url, allowsIncentives: editing.allowsIncentives, minChars: editing.minChars }} />}

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <h2 className="mb-1 text-lg">No portals yet</h2>
          <p className="text-sm text-ink-2">Add the places customers can post their review.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((p, i) => {
            const locked = isLockedType(p.type);
            return (
              <Card key={p.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-3 px-[18px] py-4">
                <div className="min-w-[160px] flex-1">
                  <h2 className="flex items-center gap-2 text-base tracking-[-0.01em]">
                    {p.label}
                    {p.id === mainId && <Pill tone="blue">Main</Pill>}
                  </h2>
                  <span className="block truncate text-[13px] text-ink-3">{p.url.replace(/^https:\/\//, "")} · {p.type}</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-3">
                  Default
                  <ActionToggle on={p.isDefault} label={`${p.label} is a default portal`} action={setPortalDefault.bind(null, p.id)} />
                </label>
                <div className="flex items-center gap-2 text-xs text-ink-3">
                  {locked ? <Icons.Lock size={13} aria-hidden /> : null}
                  Rewards
                  <ActionToggle
                    on={canIncentivize(p)}
                    locked={locked}
                    label={locked ? `Rewards are not allowed on ${p.label}` : `Offer rewards on ${p.label}`}
                    action={setPortalIncentives.bind(null, p.id)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={movePortal}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <Button type="submit" variant="ghost" size="sm" aria-label={`Move ${p.label} ${dir}`} disabled={dir === "up" ? i === 0 : i === rows.length - 1}>
                        {dir === "up" ? "↑" : "↓"}
                      </Button>
                    </form>
                  ))}
                  <Link href={`/admin/portals?edit=${p.id}`} className={buttonClass("ghost", "sm")} aria-label={`Edit ${p.label}`}>
                    <Icons.Pencil size={14} aria-hidden />Edit
                  </Link>
                  <form action={deletePortal}>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton message={`Delete ${p.label}? This cannot be undone.`} aria-label={`Delete ${p.label}`}>
                      <Icons.Trash2 size={14} aria-hidden />
                    </ConfirmButton>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
