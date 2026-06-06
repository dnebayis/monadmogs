import { NextResponse, type NextRequest } from "next/server";

function corsOrigin(request: NextRequest) {
  const configured = process.env.CORS_ALLOWED_ORIGIN || "*";
  if (configured === "*") return "*";

  const origin = request.headers.get("origin");
  const allowed = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || "*";
}

function withCors(response: NextResponse, request: NextRequest) {
  response.headers.set("Access-Control-Allow-Origin", corsOrigin(request));
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-secret");
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin");
  return response;
}

export function proxy(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return withCors(new NextResponse(null, { status: 204 }), request);
  }

  return withCors(NextResponse.next(), request);
}

export const config = {
  matcher: ["/api/:path*", "/llms.txt", "/agent-prompt.txt", "/arena-skill.md"],
};
