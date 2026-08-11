"use client";

import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import ReportsView from "@/components/reports/ReportsView";

export default function ReportsPage() {
  return (
    <ProtectedPage permission="viewRecordingHistory">
      <AppShell>
        <ReportsView />
      </AppShell>
    </ProtectedPage>
  );
}