"use client";

import ProtectedPage from "@/components/auth/ProtectedPage";
import AppShell from "@/components/layout/AppShell";
import UsersView from "@/components/users/UsersView";

export default function UsersPage() {
  return (
    <ProtectedPage permission="manageUsers">
      <AppShell>
        <UsersView />
      </AppShell>
    </ProtectedPage>
  );
}
