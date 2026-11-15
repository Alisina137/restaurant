"use client";
import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { WorkspaceContext } from "@/lib/context";
export type WorkspaceState = {
  workspace: WorkspaceContext;
  setWorkspace: Dispatch<SetStateAction<WorkspaceContext | null>>;
};
export const WorkspaceProvider = createContext<WorkspaceState | null>(null);
export function useWorkspace() {
  const ctx = useContext(WorkspaceProvider);
  if (!ctx) throw new Error("WorkspaceProvider unavailable");
  return ctx;
}
