import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/urls";

export function GET() {
  return NextResponse.redirect(`${API_BASE_URL}/llms.txt`, 308);
}
