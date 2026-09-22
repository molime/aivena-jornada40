import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Entrar — JORNADA40" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4">
      {/* Resplandor ámbar de marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(ellipse at center, #f5a623 0%, transparent 65%)" }}
      />
      <div className="relative mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2.5">
          <span className="inline-block h-8 w-8 rounded-lg bg-brand" aria-hidden />
          <span className="text-2xl font-bold tracking-tight">
            JORNADA<span className="text-brand">40</span>
          </span>
        </div>
        <p className="text-sm text-muted">
          Programación semanal de personal retail bajo el tope de 40 horas
        </p>
        <p className="mt-1 text-xs text-faint">AIvena · Workforce optimization</p>
      </div>
      <div className="relative">
        <LoginForm />
      </div>
    </main>
  );
}
