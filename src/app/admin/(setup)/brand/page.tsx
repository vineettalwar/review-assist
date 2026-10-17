import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, QuestionFlow, BigInput, BigTextarea, Choices } from "@/components/ui";
import { getActiveBrand } from "@/lib/brand";
import { MemoryPanel } from "../memory/MemoryPanel";
import { LANGUAGES, VOICES } from "../constants";
import { Flash } from "../flash";
import { saveBrand } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const sp = await searchParams;
  const b = await getActiveBrand();
  if (!b) redirect("/admin/onboarding");
  const name = b.name;

  return (
    <>
      <PageHeader title="Brand"  />
      <Flash saved={sp.saved} error={sp.error} />
      <form action={saveBrand}>
        <QuestionFlow
          submitLabel="Save brand"
          questions={[
            { title: "What's your business called?", htmlFor: "name", required: true, body: <BigInput id="name" name="name" defaultValue={name} required autoComplete="organization" /> },
            { title: "What's your website?", htmlFor: "website", body: <BigInput id="website" name="website" type="url" placeholder="https://" defaultValue={b.website} /> },
            {
              title: "Add your logo",
              hint: "PNG, JPG or WebP, up to 1MB.",
              body: (
                <div className="flex items-center gap-4">
                  <div className="grid size-[64px] flex-none place-items-center overflow-hidden rounded bg-ink text-xl font-bold text-white">
                    {b.logoKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/admin/brand/logo?v=${b.updatedAt}`} alt="Current logo" className="size-full bg-white object-contain" />
                    ) : (
                      (name.trim()[0] ?? "R").toUpperCase()
                    )}
                  </div>
                  <div className="grid gap-2">
                    <input type="file" name="logo" aria-label="Logo" accept="image/png,image/jpeg,image/webp" className="text-[13px] text-ink-2 file:mr-3 file:h-9 file:cursor-pointer file:rounded file:border file:border-rule file:bg-white file:px-3 file:text-[13px] file:font-medium file:text-ink hover:file:border-ink" />
                    {b.logoKey && (
                      <label className="flex items-center gap-2 text-[13px] text-ink-2">
                        <input type="checkbox" name="removeLogo" value="1" /> Remove current logo
                      </label>
                    )}
                  </div>
                  {b.logoKey && <span data-answered hidden />}
                </div>
              ),
            },
            { title: "What do you do?", hint: "A sentence or two.", htmlFor: "about", long: true, body: <BigTextarea id="about" name="about" defaultValue={b.about ?? ""} /> },
            { title: "Who are your customers?", htmlFor: "audience", long: true, body: <BigTextarea id="audience" name="audience" rows={2} defaultValue={b.audience ?? ""} /> },
            { title: "What's true for every product?", hint: "One fact per line.", htmlFor: "facts", long: true, body: <BigTextarea id="facts" name="facts" rows={4} defaultValue={b.facts ?? ""} /> },
            { title: "How should reviews sound?", body: <Choices name="voice" label="Tone" options={VOICES} defaultValue={b.voice ?? "warm"} /> },
            { title: "Anything else about your voice?", hint: "Optional.", htmlFor: "voiceNotes", long: true, body: <BigTextarea id="voiceNotes" name="voiceNotes" defaultValue={b.voiceNotes ?? ""} /> },
            { title: "Any words to avoid?", hint: "Comma separated.", htmlFor: "wordsToAvoid", body: <BigInput id="wordsToAvoid" name="wordsToAvoid" defaultValue={b.wordsToAvoid ?? ""} /> },
            { title: "Which language by default?", body: <Choices name="defaultLanguage" label="Default language" options={LANGUAGES} defaultValue={b.defaultLanguage ?? "en"} /> },
          ]}
        />
      </form>

      <div className="mt-10 max-w-[720px] lg:ml-[232px]">
        <MemoryPanel brandId={b.id} productId={null} returnTo="/admin/brand" title="Brand memory" />
        <p className="mt-2 text-[13px] text-ink-2"><Link href="/admin/memory" className="underline underline-offset-2">Open all memory</Link></p>
      </div>
    </>
  );
}
