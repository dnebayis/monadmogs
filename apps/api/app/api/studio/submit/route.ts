import { NextResponse, type NextRequest } from "next/server";
import { submitProject, validateStudioSubmission } from "@/lib/studio";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit: 3 submissions per hour per IP
  const ip = getClientIp(request);
  const rl = await rateLimit(`studio-submit:${ip}`, 3, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: rl.status === 429 ? "Too many submissions. Try again later." : rl.message, degraded: rl.status === 503 ? true : undefined },
      {
        status: rl.status,
        headers: rl.status === 429 ? { "Retry-After": String(rl.retryAfter) } : undefined,
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = validateStudioSubmission(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const project = await submitProject(result.data);
    return NextResponse.json({ success: true, id: project.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Submission failed. Try again later." }, { status: 500 });
  }
}
