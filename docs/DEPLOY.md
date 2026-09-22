# Despliegue — JORNADA40

## ¿Dónde? Recomendación: **Railway** (primera opción) o **Render**

**Por qué no Vercel/Convex:** la app usa **SQLite con archivo persistente** y un servidor
Node **de larga duración** (sessions de Better Auth, servidor en un proceso). Vercel es
serverless (filesystem efímero → SQLite no sobrevive; habría que migrar a Postgres) y Convex
es una base de datos/functions, no un host para una app Next.js completa — son la herramienta
equivocada para este stack tal cual.

**Por qué Railway/Render:** corren un proceso Node continuo, permiten un **disco persistente**
para `dev.db`, despliegan directo desde GitHub con un `Dockerfile` o build/start commands, y
tienen TLS + dominio público en 2 clics. (El proyecto `front-desk-assignment` ya usa este
patrón en Railway con el mismo stack: un proceso Node + SQLite en volumen.)

---

## Opción A — Railway (recomendada)

El repo ya incluye `Dockerfile` y `.dockerignore` → Railway detecta y despliega solo.

1. **Crear el repo en GitHub** (hecho: `github.com/molime/aivena-jornada40`).
2. En [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo** →
   elige `aivena-jornada40`.
3. **Añade un volumen persistente** (para que SQLite no se pierda entre deploys):
   - En el servicio → *Settings → Volumes* → mount path **`/app/prisma`**.
4. **Variables de entorno** (en *Variables*):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | `file:/app/prisma/dev.db` |
   | `BETTER_AUTH_SECRET` | `<openssl rand -base64 32>` (uno nuevo, no el de dev) |
   | `BETTER_AUTH_URL` | `https://<tu-dominio-railway>.up.railway.app` |
   | `OPENAI_API_KEY` | *(opcional)* solo si quieres el asistente IA en vivo |

5. **Comandos** (Railway los infiere del Dockerfile; si usas build/start commands):
   - Build: `npm ci && npx prisma db push && npm run build`
   - Start: `npx prisma db push && npx tsx prisma/seed.ts && npm start`
     - `prisma db push` crea el schema si el volumen está vacío; el seed es **idempotente**
       (limpia y re-siembra), así que es seguro correrlo en cada arranque.
6. **Dominio:** *Settings → Networking → Generate Domain* → HTTPS público. Copia esa URL en
   `BETTER_AUTH_URL` (paso 4) y redeploy.

> **Importante:** `BETTER_AUTH_URL` debe coincidir **exactamente** con la URL pública (esquema
> incluido). Si no, el login falla con 403 ( chequeo de origin de Better Auth ).

## Opción B — Render

1. [render.com](https://render.com) → **New → Web Service** → conecta el repo.
2. Build Command: `npm ci && npx prisma db push && npm run build`
3. Start Command: `npx prisma db push && npx tsx prisma/seed.ts && npm start`
4. **Persistent Disk** (*Settings → Disks*): mount path **`/app/prisma`**, tamaño 1 GB.
5. Env vars: iguales que Railway (adapta `DATABASE_URL` al mount path del disco).

## Opción C — Vercel (solo si migras a Postgres)

Vercel es ideal para Next.js **pero requiere cambiar SQLite → Postgres** (Neon/Vercel
Postgres): cambiar el `provider` en `prisma/schema.prisma`, correr migraciones, y ajustar el
seed. El resto (Next.js, Better Auth) funciona igual. **Solo recomendable si quieres
escala serverless; para el demo, Railway/Render es menos fricción.**

---

## Checklist post-deploy (probar antes de la demo)

- [ ] `https://<url>` redirige a `/login`
- [ ] Login con `admin@demo.mx / demo1234` funciona (valida `BETTER_AUTH_URL`)
- [ ] «Generar programación」 produce ~30% de ahorro y 0 violaciones
- [ ] Aprobar → Publicar → CSV funciona
- [ ] El disco persiste: genera una corrida, redeploy, y la corrida sigue ahí

## Credenciales para la demo

**`admin@demo.mx` / `demo1234`** (las incluye el seed en cada arranque).
