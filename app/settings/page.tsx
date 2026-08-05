"use client";

import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import PlaceholderPage from "@/components/layout/PlaceholderPage";

export default function SettingsPage() {
  return (
    <ProtectedPage permission="accessSettings">
      <AppShell>
        <PlaceholderPage
          title="Settings"
          description="Pengaturan sistem hanya tersedia untuk Master."
        />
      </AppShell>
    </ProtectedPage>
  );
}
