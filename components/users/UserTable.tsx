"use client";

import {
  NoSymbolIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import MedicalCard from "@/components/common/MedicalCard";
import StatusBadge from "@/components/common/StatusBadge";
import type { StaffUser } from "@/services/user.service";
import { formatDateTime } from "@/utils/time";

type Props = {
  readonly users: readonly StaffUser[];
  readonly loading: boolean;
  readonly disablingUid: string | null;
  readonly onEdit: (user: StaffUser) => void;
  readonly onDisable: (user: StaffUser) => void;
};

const roleTone = {
  master: "blue",
  doctor: "green",
  nurse: "yellow",
} as const;

export default function UserTable({
  users,
  loading,
  disablingUid,
  onEdit,
  onDisable,
}: Props) {
  return (
    <MedicalCard title="User List">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-[var(--foreground)]">
          <thead className="border-b border-[var(--border)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">
                Display Name
              </th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Created At</th>
              <th className="px-4 py-3 text-center font-medium">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-[var(--text-secondary)]"
                >
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-[var(--text-secondary)]"
                >
                  No staff users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.uid}
                  className="transition-colors hover:bg-[var(--surface-secondary)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {user.displayName}
                  </td>

                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {user.email}
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge
                      label={user.role}
                      tone={roleTone[user.role]}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge
                      label={user.status}
                      tone={user.status === "active" ? "green" : "gray"}
                    />
                  </td>

                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {formatDateTime(user.createdAt)}
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--primary)] text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                        aria-label={`Edit ${user.displayName}`}
                        title="Edit user"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDisable(user)}
                        disabled={
                          user.status === "inactive" ||
                          disablingUid === user.uid
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[var(--danger)] text-white transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Disable ${user.displayName}`}
                        title="Disable user"
                      >
                        <NoSymbolIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </MedicalCard>
  );
}
