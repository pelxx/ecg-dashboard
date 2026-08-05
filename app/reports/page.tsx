"use client";

import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import PlaceholderPage from "@/components/layout/PlaceholderPage";

export default function ReportsPage() {
  return (
    <ProtectedPage permission="viewReports">
      <AppShell>
        <PlaceholderPage
          title="Reports"
          description="Riwayat rekaman dan export ECG yang tersedia untuk role ini."
        />
      </AppShell>
    </ProtectedPage>
  );
}
