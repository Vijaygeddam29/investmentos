import { ReactNode, createContext, useContext } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";

interface SidebarCtx {
  open: boolean;
  isMobile: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarCtx>({ open: false, isMobile: false, toggle: () => {}, close: () => {} });
export const useSidebarCtx = () => useContext(SidebarContext);

export function Layout({ children }: { children: ReactNode }) {
  const sidebar = useMobileSidebar();

  return (
    <SidebarContext.Provider value={sidebar}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 overflow-auto p-3 md:p-6 relative">
            {children}
          </main>
        </div>
        <ChatPanel />
      </div>
    </SidebarContext.Provider>
  );
}
