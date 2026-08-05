"use client";

import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import PlaceholderPage from "@/components/layout/PlaceholderPage";

export default function DashboardPage() {
  return (
    <ProtectedPage permission="viewDashboard">
      <AppShell>
        <PlaceholderPage
          title="Dashboard"
          description="Ringkasan monitoring ECG dan status device."
        />
      </AppShell>
    </ProtectedPage>
  );
}
