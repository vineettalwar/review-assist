import { redirect } from "next/navigation";
import { PageHeader, Section, Textarea, SubmitButton } from "@/components/ui";
import { getActiveBrand } from "@/lib/brand";
import { parseRules, RULES_MAX } from "@/lib/rules";
import { Flash } from "../flash";
import { saveRules } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const active = await getActiveBrand();
  if (!active) redirect("/admin/onboarding");
  const rules = parseRules(active.rules);

  return (
    <>
      <PageHeader title="Rules" description={`Dos and don'ts for ${active.name}. Other clients never see them.`} />
      <Flash saved={sp.saved} error={sp.error} />
      <form action={saveRules} className="max-w-[760px]">
        <Section title="Genuine-experience mode" description="For clients whose review sites or policies require reviews based only on real, stated experience.">
          <label className="flex items-start gap-3 text-[15px]">
            <input type="checkbox" name="strict" defaultChecked={active.strict} className="mt-1 size-4 accent-[var(--color-carbon)]" />
            <span>
              On for this client
              <span className="mt-1 block text-[13px] text-ink-3">
                The page asks neutrally and writes nothing until the customer rates. Drafts use only the situations and points the
                customer picks plus their own words, never typical journeys or praise from the product setup, and contain no numbers.
                The reward is hidden.
              </span>
            </span>
          </label>
        </Section>

        <Section title="Draft rules" description={`Sent with every draft for this client, after the built-in rules. One per line, up to ${RULES_MAX}.`}>
          <Textarea
            name="draft"
            rows={12}
            defaultValue={rules.draft.join("\n")}
            placeholder={"Never call a humidifier a filter-based air purifier.\nNo medical or health claims."}
            aria-label="Draft rules, one per line"
          />
        </Section>

        <Section title="Team rules" description="A checklist for whoever sends review requests. Never sent to the AI. One per line.">
          <Textarea
            name="team"
            rows={10}
            defaultValue={rules.team.join("\n")}
            placeholder={"Ask for honest feedback, never for a positive or five-star review.\nLog every request with its date and channel."}
            aria-label="Team rules, one per line"
          />
        </Section>

        <SubmitButton>Save rules</SubmitButton>
      </form>
    </>
  );
}
