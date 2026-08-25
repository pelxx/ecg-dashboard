"use client";

import { useEffect, useState } from "react";
import MedicalCard from "@/components/common/MedicalCard";
import { auth } from "@/lib/firebase";
import {
  disableUser,
  subscribeUsers,
  updateUser,
  type StaffUser,
} from "@/services/user.service";
import UserDialog, { type UserDialogMode, type UserDialogSubmit } from "./UserDialog";
import UserTable from "./UserTable";

export default function UsersView() {
  const [users, setUsers] = useState<readonly StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<UserDialogMode>("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [disablingUid, setDisablingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (nextUsers) => {
        setUsers(nextUsers);
        setLoading(false);
      },
      (nextError) => {
        console.error("Failed to load users:", nextError);
        setError("Failed to load users.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const openCreateDialog = () => {
    setDialogMode("create");
    setSelectedUser(null);
    setDialogError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (user: StaffUser) => {
    setDialogMode("edit");
    setSelectedUser(user);
    setDialogError(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogOpen(false);
    setSelectedUser(null);
    setDialogError(null);
  };

  const createUser = async (payload: Extract<UserDialogSubmit, { mode: "create" }>) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("Authentication session is not available.");
    }

    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: payload.displayName,
        email: payload.email,
        password: payload.password,
        role: payload.role,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(result?.error ?? "Failed to create user.");
    }
  };

  const handleSubmit = async (payload: UserDialogSubmit) => {
    setSaving(true);
    setDialogError(null);

    try {
      if (payload.mode === "create") {
        await createUser(payload);
      } else {
        await updateUser(payload.uid, {
          displayName: payload.displayName,
          role: payload.role,
          status: payload.status,
        });
      }

      setDialogOpen(false);
      setSelectedUser(null);
      setDialogError(null);
    } catch (nextError) {
      console.error("Failed to save user:", nextError);
      setDialogError(
        nextError instanceof Error ? nextError.message : "Failed to save user."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (user: StaffUser) => {
    if (user.status === "inactive") return;
    if (!window.confirm(`Disable ${user.displayName}?`)) return;

    setDisablingUid(user.uid);
    try {
      await disableUser(user.uid);
    } catch (nextError) {
      console.error("Failed to disable user:", nextError);
      alert("Failed to disable user.");
    } finally {
      setDisablingUid(null);
    }
  };

  return (
    <section className="space-y-5 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-emerald-300">Users</h1>
          <p className="text-sm text-slate-500">
            Manage healthcare staff accounts and roles.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateDialog}
          className="w-fit rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Add User
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <MedicalCard title="Staff Summary">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <SummaryValue label="Total" value={users.length} />
          <SummaryValue
            label="Active"
            value={users.filter((user) => user.status === "active").length}
          />
          <SummaryValue
            label="Doctors"
            value={users.filter((user) => user.role === "doctor").length}
          />
          <SummaryValue
            label="Nurses"
            value={users.filter((user) => user.role === "nurse").length}
          />
        </div>
      </MedicalCard>

      <UserTable
        users={users}
        loading={loading}
        disablingUid={disablingUid}
        onEdit={openEditDialog}
        onDisable={handleDisable}
      />

      <UserDialog
        open={dialogOpen}
        mode={dialogMode}
        user={selectedUser}
        saving={saving}
        error={dialogError}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />
    </section>
  );
}

function SummaryValue({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-emerald-300">{value}</p>
    </div>
  );
}
