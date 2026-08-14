import { lookupCertificate } from "@/lib/certificate/lookup";
import { renderCertificateImage } from "@/lib/certificate/render";
import { resolveCreativeRatio, type CreativeRatio } from "@/lib/share/compose";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  try {
    const data = await lookupCertificate(token);
    const raw = new URL(request.url).searchParams.get("ratio");
    const ratio: CreativeRatio | "print" =
      raw === "print" ? "print" : (resolveCreativeRatio(raw) ?? "print");
    const image = renderCertificateImage(data, ratio);
    image.headers.set("X-Robots-Tag", "noindex, nofollow");
    image.headers.set("Cache-Control", "private, no-store");
    image.headers.set("Referrer-Policy", "no-referrer");
    return image;
  } catch (error) {
    const status =
      error instanceof AppError && error.code === ERROR_CODES.CERTIFICATE_INVALID ? 404 : 503;
    return new Response("Not found", { status });
  }
}
