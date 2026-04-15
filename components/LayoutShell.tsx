"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function LayoutShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSharePage = pathname.startsWith("/share");

  if (isSharePage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56">{children}</main>
    </div>
  );
}
