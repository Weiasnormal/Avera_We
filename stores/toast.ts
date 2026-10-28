import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; href: string };
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, tone?: ToastTone, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, tone = "success", action) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, tone, action }] }));
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export const toast = {
  success: (message: string, action?: Toast["action"]) => useToastStore.getState().show(message, "success", action),
  error: (message: string, action?: Toast["action"]) => useToastStore.getState().show(message, "error", action),
  info: (message: string, action?: Toast["action"]) => useToastStore.getState().show(message, "info", action),
};
