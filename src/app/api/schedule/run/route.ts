import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runSchedulerForAllStores } from "@/server/run-scheduler";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// POST /api/schedule/run — ejecuta el solver para todas las tiendas y persiste la corrida.
export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const summaries = await runSchedulerForAllStores();
    return NextResponse.json({ ok: true, summaries });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al ejecutar el solver" },
      { status: 500 }
    );
  }
}
