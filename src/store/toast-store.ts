import { create } from "zustand";

export type ToastTone = "success" | "error";

export type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
};

type ToastState = {
  toasts: Toast[];
  show: (tone: ToastTone, message: string) => void;
  dismiss: (id: string) => void;
};

const SUCCESS_DISMISS_MS = 5000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (tone, message) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }));

    if (tone === "success") {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, SUCCESS_DISMISS_MS);
    }
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Imperative API so any handler (client event, effect) can fire a toast
// without importing the hook: toast.success("RFQ-0412 sent to 4 vendors").
export const toast = {
  success: (message: string) => useToastStore.getState().show("success", message),
  error: (message: string) => useToastStore.getState().show("error", message),
};
