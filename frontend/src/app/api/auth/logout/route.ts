import type { NextRequest } from "next/server";
import { logout } from "@/lib/bff/bff";

export const POST = (req: NextRequest) => logout(req);
