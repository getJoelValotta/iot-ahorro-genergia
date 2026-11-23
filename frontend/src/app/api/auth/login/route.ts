import type { NextRequest } from "next/server";
import { loginOrRegister } from "@/lib/bff/bff";

export const POST = (req: NextRequest) => loginOrRegister(req, "login");
