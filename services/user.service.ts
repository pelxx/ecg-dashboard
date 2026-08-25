import { off, onValue, ref, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import { isUserRole, type UserRole } from "@/lib/permissions";

export type UserStatus = "active" | "inactive";

export type StaffUser = {
  readonly uid: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type UpdateUserInput = {
  readonly displayName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
};

type RawUser = {
  readonly displayName?: unknown;
  readonly email?: unknown;
  readonly role?: unknown;
  readonly status?: unknown;
  readonly createdAt?: unknown;
  readonly updatedAt?: unknown;
};

const isUserStatus = (value: unknown): value is UserStatus =>
  value === "active" || value === "inactive";

const toTimestamp = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const normalizeUser = (uid: string, raw: RawUser = {}): StaffUser | null => {
  if (!isUserRole(raw.role)) return null;

  return {
    uid,
    displayName:
      typeof raw.displayName === "string" ? raw.displayName : "Unnamed User",
    email: typeof raw.email === "string" ? raw.email : "",
    role: raw.role,
    status: isUserStatus(raw.status) ? raw.status : "active",
    createdAt: toTimestamp(raw.createdAt),
    updatedAt: toTimestamp(raw.updatedAt),
  };
};

export const subscribeUsers = (
  onUsers: (users: readonly StaffUser[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const node = ref(rtdb, "users");
  const unsubscribe = onValue(
    node,
    (snapshot) => {
      const value = (snapshot.val() || {}) as Record<string, RawUser>;
      const users = Object.entries(value)
        .map(([uid, raw]) => normalizeUser(uid, raw ?? {}))
        .filter((user): user is StaffUser => user !== null)
        .sort(
          (a, b) =>
            (b.createdAt || b.updatedAt || 0) - (a.createdAt || a.updatedAt || 0)
        );

      onUsers(users);
    },
    (error) => onError?.(error)
  );

  return () => off(node, "value", unsubscribe);
};

export const updateUser = async (
  uid: string,
  input: UpdateUserInput
): Promise<void> => {
  await update(ref(rtdb, `users/${uid}`), {
    displayName: input.displayName.trim(),
    role: input.role,
    status: input.status,
    updatedAt: Date.now(),
  });
};

export const disableUser = async (uid: string): Promise<void> => {
  await update(ref(rtdb, `users/${uid}`), {
    status: "inactive",
    updatedAt: Date.now(),
  });
};
