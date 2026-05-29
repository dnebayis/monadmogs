import { NextResponse, type NextRequest } from "next/server";
import { submitProject, validateStudioSubmission } from "@/lib/studio";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit: 3 submissions per hour per IP
  const ip = getClientIp(request);
  const rl = await rateLimit(`studio-submit:${ip}`, 3, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
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
