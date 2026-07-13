import { create } from 'zustand';

const ACTIVE_KEY = 'reachflow.activeWorkspaceId';

interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string) => void;
  clearActiveWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId:
    typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null,
  setActiveWorkspace: (id) => {
    localStorage.setItem(ACTIVE_KEY, id);
    set({ activeWorkspaceId: id });
  },
  clearActiveWorkspace: () => {
    localStorage.removeItem(ACTIVE_KEY);
    set({ activeWorkspaceId: null });
  },
}));
