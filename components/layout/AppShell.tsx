"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { navigationItems } from "@/lib/permissions";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeMQTT } from "@/components/realtime/MQTTProvider";
import ThemeToggle from "@/components/common/ThemeToggle";

type Props = {
  children: ReactNode;
};

const INACTIVITY_TIMEOUT = 15 *60 * 1000;

export default function AppShell({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { permissions, profile } = useAuth();
  const { recordingStatuses, flushRecordings } = useRealtimeMQTT();
  const hasActiveRecordings = Object.values(recordingStatuses).some(
    (status) => status.isRecording
  );

  const items = navigationItems.filter(
    (item) => permissions?.[item.permission]
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const startTimer = () => {
      clearTimer();
      if (hasActiveRecordings) return;

      timer = setTimeout(async () => {
        try {
          await signOut(auth);
          router.replace("/");
        } catch (error) {
          console.error("Failed to auto logout:", error);
        }
      }, INACTIVITY_TIMEOUT);
    };

    const handleActivity = () => {
      if (auth.currentUser) {
        startTimer();
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        startTimer();
      } else {
        clearTimer();
      }
    });

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      clearTimer();
      unsubscribe();

      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [hasActiveRecordings, router]);

  const handleSignOut = async () => {
    await flushRecordings();
    await signOut(auth);
    router.replace("/");
  };


  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3 transition-colors duration-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)]">
              Pemantauan ECG dan Pengujian MQTT ECG
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              {profile?.displayName ?? "Authenticated user"}
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-[var(--primary)] text-white"
                      : "bg-[var(--surface-secondary)] text-[var(--foreground)] hover:opacity-80"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <ThemeToggle />

            <button
              onClick={handleSignOut}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]"
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