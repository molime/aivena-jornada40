import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/server/api-auth";
import { approveRun } from "@/server/run-scheduler";

export const dynamic = "force-dynamic";

// POST /api/schedule/[runId]/approve
export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!(await getSessionOrNull())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { runId } = await params;
  try {
    const run = await approveRun(runId);
    return NextResponse.json({ ok: true, status: run.status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 400 });
  }
}
