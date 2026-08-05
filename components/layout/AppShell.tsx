"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { navigationItems } from "@/lib/permissions";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  children: ReactNode;
};

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { permissions, profile } = useAuth();
  const items = navigationItems.filter(
    (item) => permissions?.[item.permission]
  );

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/");
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 bg-gray-950/90 px-6 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-bold text-blue-400">ECG Dashboard</h1>
            <p className="text-xs text-gray-500">
              {profile?.displayName ?? "Authenticated user"}
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-gray-900 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="rounded border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-900"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      {children}
    </main>
  );
}
