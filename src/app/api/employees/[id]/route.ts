import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/server/api-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/employees/[id] — edición y baja/reactivación (active=false).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionOrNull())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.role !== undefined) data.role = String(body.role);
    if (body.hourlyRate !== undefined) {
      if (!(body.hourlyRate > 0)) return NextResponse.json({ ok: false, error: "Tarifa inválida" }, { status: 400 });
      data.hourlyRate = Number(body.hourlyRate);
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const emp = await db.employee.update({ where: { id }, data });
    return NextResponse.json({ ok: true, employee: emp });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
