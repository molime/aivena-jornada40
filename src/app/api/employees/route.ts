import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/server/api-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/employees — alta de empleado.
export async function POST(req: Request) {
  if (!(await getSessionOrNull())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    const body = await req.json();
    const { name, role, hourlyRate, storeId } = body ?? {};
    if (!name || !role || !storeId || !(hourlyRate > 0)) {
      return NextResponse.json({ ok: false, error: "name, role, hourlyRate y storeId son requeridos" }, { status: 400 });
    }
    const store = await db.store.findUnique({ where: { id: storeId } });
    if (!store) return NextResponse.json({ ok: false, error: "Tienda no encontrada" }, { status: 404 });

    // código correlativo por tienda: EMP-<tienda>-<n>
    const count = await db.employee.count({ where: { storeId } });
    const emp = await db.employee.create({
      data: {
        code: `EMP-${String(count + 1).padStart(3, "0")}`,
        name: String(name),
        role: String(role),
        hourlyRate: Number(hourlyRate),
        storeId,
        // sin turnos base: entra como personal disponible para el solver
      },
    });
    return NextResponse.json({ ok: true, employee: emp });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
