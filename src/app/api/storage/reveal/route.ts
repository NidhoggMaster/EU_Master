import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { assertLocalMutation, errorResponse } from "@/lib/server/local-api";
import { materialDataDirectory, privateDataDirectory } from "@/lib/server/local-store";

export const runtime = "nodejs";
const run = promisify(execFile);
const inputSchema = z.object({ target: z.enum(["private_data", "material_center"]) });

export async function POST(request: Request) {
  try {
    assertLocalMutation(request);
    if (process.platform !== "darwin") throw Object.assign(new Error("仅 macOS 支持在访达中显示。"), { status: 501 });
    const input = inputSchema.parse(await request.json());
    const directory = input.target === "private_data" ? privateDataDirectory() : materialDataDirectory();
    await run("/usr/bin/open", [directory], { timeout: 5_000 });
    return Response.json({ opened: true });
  } catch (error) { return errorResponse(error, "无法打开本地目录。"); }
}
