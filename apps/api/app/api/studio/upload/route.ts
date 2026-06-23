import { NextResponse, type NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`studio-upload:${ip}`, 5, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.status === 429 ? "Too many uploads. Try again later." : rl.message, degraded: rl.status === 503 ? true : undefined },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      }
    );
  }

  const contentType = request.headers.get("content-type") || "";

  if (!ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, and GIF images are allowed." },
      { status: 400 }
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = Number(contentLengthHeader);
  if (!contentLengthHeader || !Number.isFinite(contentLength) || contentLength <= 0) {
    return NextResponse.json(
      { error: "Content-Length is required for uploads." },
      { status: 411 }
    );
  }
  if (contentLength > MAX_SIZE) {
    return NextResponse.json(
      { error: "Image must be under 2MB." },
      { status: 400 }
    );
  }

  const body = request.body;
  if (!body) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "jpg";

  const filename = `studio/${crypto.randomUUID()}.${ext}`;

  try {
    const blob = await put(filename, body, {
      access: "public",
      contentType,
    });

    return NextResponse.json({ url: blob.url }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
