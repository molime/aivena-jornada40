import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Guard para route handlers: devuelve la sesión o null (el caller responde 401). */
export async function getSessionOrNull() {
  return auth.api.getSession({ headers: await headers() });
}
