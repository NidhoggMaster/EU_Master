import { NextResponse } from "next/server";
import { getEurCnyRate } from "@/lib/server/exchange-rates";

export const runtime = "nodejs";
export async function GET() {
  try { return NextResponse.json(await getEurCnyRate()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "汇率暂时不可用。" }, { status: 503 }); }
}
