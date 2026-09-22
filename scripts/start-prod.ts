// Arranque de producción: asegura schema y seed SOLO si la base está vacía.
// Así un redeploy no borra las programaciones que el usuario ya generó.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient();
  try {
    console.log("[start] prisma db push...");
    execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

    const users = await db.user.count();
    const stores = await db.store.count();
    if (users === 0 || stores === 0) {
      console.log("[start] base vacía, corriendo seed...");
      execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    } else {
      console.log(`[start] base ya inicializada (${users} usuarios, ${stores} tiendas) — seed omitido.`);
    }
  } finally {
    await db.$disconnect();
  }

  console.log("[start] lanzando next start...");
  execSync("npx next start", { stdio: "inherit" });
}

main().catch((err) => {
  console.error("[start] falló el arranque:", err);
  process.exit(1);
});
