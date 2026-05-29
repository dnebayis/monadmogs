import { NextResponse } from "next/server";
import { getApprovedProjects } from "@/lib/studio";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`studio-read:${ip}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const projects = await getApprovedProjects();

  return NextResponse.json(
    { projects },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
