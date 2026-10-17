import { getActiveBrand } from "@/lib/brand";
import { getR2 } from "@/lib/env";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthed())) return new Response("Unauthorized", { status: 401 });
  const b = await getActiveBrand();
  if (!b?.logoKey) return new Response("Not found", { status: 404 });
  const obj = await (await getR2()).get(b.logoKey);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body as ReadableStream, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
