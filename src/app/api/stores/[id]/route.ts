import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/server/api-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// PATCH /api/stores/[id] — edición de tienda y su configuración operativa (serviceRate, minStaff, horarios).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionOrNull())) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name);
    if (body.city !== undefined) data.city = String(body.city);
    if (body.openHour !== undefined) {
      const v = Number(body.openHour);
      if (!(v >= 0 && v <= 23)) return NextResponse.json({ ok: false, error: "openHour inválido" }, { status: 400 });
      data.openHour = v;
    }
    if (body.closeHour !== undefined) {
      const v = Number(body.closeHour);
      if (!(v >= 1 && v <= 24)) return NextResponse.json({ ok: false, error: "closeHour inválido" }, { status: 400 });
      data.closeHour = v;
    }
    if (body.serviceRate !== undefined) {
      const v = Number(body.serviceRate);
      if (!(v >= 1 && v <= 100)) return NextResponse.json({ ok: false, error: "serviceRate inválido (1-100)" }, { status: 400 });
      data.serviceRate = v;
    }
    if (body.minStaff !== undefined) {
      const v = Number(body.minStaff);
      if (!(v >= 0 && v <= 50)) return NextResponse.json({ ok: false, error: "minStaff inválido" }, { status: 400 });
      data.minStaff = v;
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const store = await db.store.update({ where: { id }, data });
    return NextResponse.json({ ok: true, store });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
