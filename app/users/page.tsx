"use client";

import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import PlaceholderPage from "@/components/layout/PlaceholderPage";

export default function UsersPage() {
  return (
    <ProtectedPage permission="manageUsers">
      <AppShell>
        <PlaceholderPage
          title="Users"
          description="Pengelolaan user dan role hanya tersedia untuk Master."
        />
      </AppShell>
    </ProtectedPage>
  );
}
