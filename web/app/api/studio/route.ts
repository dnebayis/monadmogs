import { NextResponse } from "next/server";
import { getApprovedProjects } from "@/lib/studio";

export async function GET() {
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
