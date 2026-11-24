import { sniffImage } from "@/lib/extract.ts";
import { readUpload } from "@/lib/store.ts";

export async function GET(_req: Request, ctx: { params: Promise<{ sha: string }> }) {
  const { sha } = await ctx.params;
  const bytes = await readUpload(sha);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": sniffImage(bytes) ?? "application/octet-stream",
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
