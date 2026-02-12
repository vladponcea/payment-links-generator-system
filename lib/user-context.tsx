"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { AuthUser } from "@/lib/auth";

const UserContext = createContext<AuthUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): AuthUser | null {
  return useContext(UserContext);
}

export function useIsAdmin(): boolean {
  const user = useUser();
  return user?.role === "admin";
}
