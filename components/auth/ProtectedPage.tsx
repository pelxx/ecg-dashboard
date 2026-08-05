"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AccessDenied from "@/components/auth/AccessDenied";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

type Props = {
  permission: PermissionKey;
  children: ReactNode;
};

export default function ProtectedPage({ permission, children }: Props) {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Loading...
      </div>
    );
  }

  if (!hasPermission(role, permission)) {
    return <AccessDenied />;
  }

  return children;
}
