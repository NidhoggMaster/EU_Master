import { NextRequest, NextResponse } from "next/server";
import { CatalogFetchError } from "@/lib/catalog-server";
import { refreshStoredProgram } from "@/lib/server/refresh-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await refreshStoredProgram((await context.params).id)); }
  catch (error) {
    const status = error instanceof CatalogFetchError ? error.status : error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新失败。" }, { status });
  }
}
