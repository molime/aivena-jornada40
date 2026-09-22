import { requireUser } from "@/server/guard";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { ChatPanel } from "@/components/chat-panel";
import { ToastProvider } from "@/components/toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // toda la zona (app) exige sesión activa
  return (
    <ToastProvider>
      <div className="flex min-h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={{ email: user.email, name: user.name }} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">{children}</main>
        </div>
        <ChatPanel />
      </div>
    </ToastProvider>
  );
}
