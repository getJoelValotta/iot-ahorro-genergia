import type { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff/bff";

/** Proxy genérico del BFF: `/api/backend/<ruta>` → `<API_URL>/<ruta>` con `Bearer` de la cookie. */
type Ctx = { params: Promise<{ path: string[] }> };

const handle = async (req: NextRequest, ctx: Ctx) =>
  forwardToBackend(req, (await ctx.params).path);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
