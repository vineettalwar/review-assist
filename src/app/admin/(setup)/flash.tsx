import { Note } from "@/components/ui";

/** Reads ?saved=... / ?error=... set by server actions and shows a one-line notice. */
export function Flash({ saved, error }: { saved?: string; error?: string }) {
  if (error) return <Note className="border-danger bg-danger-wash">{error}</Note>;
  if (saved) return <Note>{saved === "1" ? "Saved." : saved}</Note>;
  return null;
}

export function qs(params: Record<string, string>) {
  return "?" + new URLSearchParams(params).toString();
}
