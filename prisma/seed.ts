// Seed: crea el esquema de datos sintéticos de "Tienda Aurora" + usuario demo de Better Auth.
// Uso: npm run db:setup   (prisma db push + este script; prisma CLI carga .env automáticamente)
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import {
  generateSyntheticData,
  OPEN_HOUR,
  CLOSE_HOUR,
} from "../src/lib/seed-data";

const STORE_COUNT = Number(process.env.STORE_COUNT ?? 3);
const EMPLOYEES_PER_STORE = Number(process.env.EMPLOYEES_PER_STORE ?? 15);

const DEMO_EMAIL = "admin@demo.mx";
const DEMO_PASSWORD = "demo1234";

async function main() {
  const db = new PrismaClient();

  // Limpieza idempotente (en orden por las foreign keys)
  await db.constraintTrace.deleteMany();
  await db.proposedShift.deleteMany();
  await db.scheduleRun.deleteMany();
  await db.baselineShift.deleteMany();
  await db.trafficHour.deleteMany();
  await db.historicalSale.deleteMany();
  await db.employee.deleteMany();
  await db.store.deleteMany();

  const stores = generateSyntheticData(STORE_COUNT, EMPLOYEES_PER_STORE);
  for (const s of stores) {
    const store = await db.store.create({
      data: {
        name: s.name,
        city: s.city,
        openHour: s.openHour ?? OPEN_HOUR,
        closeHour: s.closeHour ?? CLOSE_HOUR,
      },
    });

    await db.trafficHour.createMany({
      data: s.traffic.flatMap((row, day) =>
        row
          .map((traffic, hour) => ({ storeId: store.id, day, hour, traffic }))
          .filter((t) => t.traffic > 0)
      ),
    });
    await db.historicalSale.createMany({
      data: s.sales.map((amount, day) => ({ storeId: store.id, day, amount })),
    });

    // La demanda NO se persiste: se recalcula siempre desde el tráfico con la service rate
    // del solver (fuente única de verdad) — ver src/lib/solver/demand.ts.

    for (const e of s.employees) {
      const emp = await db.employee.create({
        data: {
          code: e.code,
          name: e.name,
          role: e.role,
          hourlyRate: e.hourlyRate,
          storeId: store.id,
        },
      });
      await db.baselineShift.createMany({
        data: e.baselineShifts.map((b) => ({ employeeId: emp.id, ...b })),
      });
    }
    console.log(`✔ ${s.name}: ${s.employees.length} empleados, ${s.traffic.flat().filter((t) => t > 0).length} celdas de tráfico`);
  }

  // Usuario demo (Better Auth: user + account credential con password hasheado por better-auth)
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!existing) {
    const user = await db.user.create({
      data: { id: crypto.randomUUID(), name: "Admin Demo", email: DEMO_EMAIL },
    });
    await db.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id, // better-auth exige accountId == user.id para el provider "credential"
        providerId: "credential",
        password: await hashPassword(DEMO_PASSWORD),
      },
    });
    console.log(`✔ Usuario demo creado: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    console.log(`✔ Usuario demo ya existía: ${DEMO_EMAIL}`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
