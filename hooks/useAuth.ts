"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";
import {
  getPermissions,
  isUserRole,
  type PermissionSet,
  type UserRole,
} from "@/lib/permissions";

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionSet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        if (!active) return;
        setUser(null);
        setProfile(null);
        setRole(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      try {
        const snapshot = await get(ref(rtdb, `users/${u.uid}`));
        const value = snapshot.val() as Partial<UserProfile> | null;
        const resolvedRole = isUserRole(value?.role) ? value.role : null;

        if (!active) return;

        setUser(u);
        setRole(resolvedRole);
        setPermissions(getPermissions(resolvedRole));
        setProfile(
          resolvedRole
            ? {
                uid: u.uid,
                displayName:
                  value?.displayName ?? u.displayName ?? u.email ?? "User",
                email: value?.email ?? u.email ?? "",
                role: resolvedRole,
              }
            : null
        );
      } catch (error) {
        console.error("Failed to load user role:", error);
        if (!active) return;
        setUser(u);
        setProfile(null);
        setRole(null);
        setPermissions(null);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  return {
    user,
    profile,
    role,
    permissions,
    loading,
    authenticated: !!user,
  };
};
