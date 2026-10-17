import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, claims, links, portals, reward, visits } from "@/db";
import { getActiveBrand } from "@/lib/brand";
import { canIncentivize } from "@/lib/compliance";
import { Button, Card, Note, PageHeader, Pill, Table, Td, Th, Tr } from "@/components/ui";
import { ActionToggle } from "@/components/ui/ActionToggle";
import { RewardForm } from "./RewardForm";
import { setClaimStatus, setRewardEnabled } from "./actions";

const tone = { pending: "amber", approved: "blue", sent: "green" } as const;

export default async function RewardsPage() {
  const b = await getActiveBrand();
  if (!b) redirect("/admin/onboarding");
  const db = await getDb();
  const [[r], portalRowsRaw, claimJoin] = await Promise.all([
    db.select().from(reward).where(eq(reward.id, b.id)).limit(1),
    db.select().from(portals).where(eq(portals.brandId, b.id)),
    // Product links leave links.customerName empty; the real name is on the visit.
    db.select({ claim: claims, visitName: visits.name, linkName: links.customerName }).from(claims)
      .innerJoin(links, eq(links.id, claims.linkId))
      .leftJoin(visits, eq(visits.id, claims.visitId))
      .where(eq(links.brandId, b.id)).orderBy(desc(claims.createdAt)).limit(200),
  ]);
  const portalRows = portalRowsRaw.sort((a, c) => a.sort - c.sort);
  const claimRows = claimJoin.map((x) => x.claim);
  const displayName = new Map(
    claimJoin.map((x) => [x.claim.id, (x.visitName || x.linkName || "").trim() || "—"]),
  );
  const portalLabel = new Map(portalRows.map((p) => [p.id, p.label]));
  const shownOn = portalRows.filter(canIncentivize);
  const cfg = r ?? { enabled: false, title: "", description: "", kind: "code" as const, value: "" };

  return (
    <>
      <PageHeader
        title="Rewards"
        description="Never depends on rating or wording."
        action={
          <label className="flex items-center gap-2.5 text-sm text-ink-2">
            {cfg.enabled ? "Enabled" : "Off"}
            <ActionToggle on={cfg.enabled} label="Rewards enabled" action={setRewardEnabled} />
          </label>
        }
      />
      <RewardForm initial={{ title: cfg.title, description: cfg.description, kind: cfg.kind, value: cfg.value }} />

      {shownOn.length === 0 ? (
        <Note>This reward will never show until a custom portal allows it. Turn rewards on for one of your custom portals on the Portals page.</Note>
      ) : (
        <p className="mb-6 text-sm text-ink-2">
          Shown on: <b className="text-ink">{shownOn.map((p) => p.label).join(", ")}</b>
          <span className="text-ink-3"> · only portals that allow rewards.</span>
        </p>
      )}

      <h2 className="mb-3 text-lg tracking-[-0.02em]">Claims</h2>
      {claimRows.length === 0 ? (
        <Card className="p-10 text-center"><p className="text-sm text-ink-2">No claims yet. They appear here when a customer asks for the reward.</p></Card>
      ) : (
        <Card className="overflow-x-auto pt-3.5">
          <Table>
            <thead>
              <tr><Th>Customer</Th><Th className="hidden sm:table-cell">Email</Th><Th>Portal</Th><Th className="hidden sm:table-cell">Created</Th><Th>Status</Th><Th><span className="sr-only">Actions</span></Th></tr>
            </thead>
            <tbody>
              {claimRows.map((c) => (
                <Tr key={c.id}>
                  <Td>{displayName.get(c.id) ?? "—"}</Td>
                  <Td className="hidden text-ink-3 sm:table-cell">{c.email}</Td>
                  <Td>{portalLabel.get(c.portalId) ?? "Removed portal"}</Td>
                  <Td className="hidden text-ink-3 sm:table-cell">{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Td>
                  <Td><Pill tone={tone[c.status]} dot>{c.status[0].toUpperCase() + c.status.slice(1)}</Pill></Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      {c.status === "pending" && (
                        <form action={setClaimStatus}>
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="approved" />
                          <Button type="submit" variant="line" size="sm">Approve</Button>
                        </form>
                      )}
                      {c.status !== "sent" && (
                        <form action={setClaimStatus}>
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value="sent" />
                          <Button type="submit" variant="line" size="sm">Mark sent</Button>
                        </form>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
