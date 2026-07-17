import { NextResponse } from "next/server";
import { listUniversities } from "@/lib/server/catalog-repository";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json(await listUniversities()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "读取学校失败。" }, { status: 500 }); }
}
