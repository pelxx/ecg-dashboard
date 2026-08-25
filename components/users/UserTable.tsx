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
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-700 text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Display Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created At</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-500">
                  No staff users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.uid}
                  className="border-b border-slate-800 text-slate-200 transition-colors hover:bg-slate-900"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {user.displayName}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={user.role} tone={roleTone[user.role]} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={user.status}
                      tone={user.status === "active" ? "green" : "gray"}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {formatDateTime(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(user)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded bg-emerald-600 text-white transition hover:bg-emerald-500"
                        aria-label={`Edit ${user.displayName}`}
                        title="Edit user"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDisable(user)}
                        disabled={
                          user.status === "inactive" || disablingUid === user.uid
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded bg-red-600 text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
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
