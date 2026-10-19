"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_ECG_WINDOW_MS } from "@/constants/ecg";
import { useAuth } from "@/hooks/useAuth";
import { useMQTT } from "@/hooks/useMQTT";

type MQTTContextValue = ReturnType<typeof useMQTT>;

const MQTTContext = createContext<MQTTContextValue | null>(null);

export function MQTTProvider({ children }: { readonly children: ReactNode }) {
  const { user } = useAuth();
  const mqtt = useMQTT({
    paperSpeed: DEFAULT_ECG_WINDOW_MS * 2,
    enabled: Boolean(user),
  });

  return <MQTTContext.Provider value={mqtt}>{children}</MQTTContext.Provider>;
}

export const useRealtimeMQTT = (): MQTTContextValue => {
  const context = useContext(MQTTContext);
  if (!context) throw new Error("useRealtimeMQTT must be used inside MQTTProvider.");
  return context;
};
