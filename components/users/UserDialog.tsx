"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { roles, type UserRole } from "@/lib/permissions";
import type { StaffUser, UserStatus } from "@/services/user.service";

export type UserDialogMode = "create" | "edit";

export type UserDialogSubmit =
  | {
      readonly mode: "create";
      readonly displayName: string;
      readonly email: string;
      readonly password: string;
      readonly role: UserRole;
    }
  | {
      readonly mode: "edit";
      readonly uid: string;
      readonly displayName: string;
      readonly role: UserRole;
      readonly status: UserStatus;
    };

type Props = {
  readonly open: boolean;
  readonly mode: UserDialogMode;
  readonly user: StaffUser | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSubmit: (payload: UserDialogSubmit) => Promise<void>;
};

export default function UserDialog({
  open,
  mode,
  user,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("doctor");
  const [status, setStatus] = useState<UserStatus>("active");

  useEffect(() => {
    if (!open) return;

    setDisplayName(user?.displayName ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setRole(user?.role ?? "doctor");
    setStatus(user?.status ?? "active");
  }, [open, user]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === "edit" && user) {
      await onSubmit({
        mode,
        uid: user.uid,
        displayName,
        role,
        status,
      });
      return;
    }

    await onSubmit({
      mode: "create",
      displayName,
      email,
      password,
      role,
    });
  };

  const secondaryButton =
    "rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50";

  const primaryButton =
    "rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl"
      >
        <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
          {mode === "create" ? "Add User" : "Edit User"}
        </h3>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-[var(--danger)] bg-[var(--surface-secondary)] p-3 text-sm text-[var(--danger)]"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Display Name">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="field-input"
              placeholder="Staff name"
              autoComplete="name"
              required
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input read-only:cursor-not-allowed read-only:opacity-60"
              placeholder="staff@example.com"
              autoComplete="email"
              readOnly={mode === "edit"}
              required
            />
          </Field>

          {mode === "create" && (
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-input"
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
          )}

          <Field label="Role">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="field-input"
            >
              {roles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>

          {mode === "edit" && (
            <Field label="Status">
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as UserStatus)
                }
                className="field-input"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </Field>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={secondaryButton}
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={saving}
            className={primaryButton}
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="block text-sm text-[var(--foreground)]">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}