import { Toaster } from "sonner";

/**
 * Global toast container — mounted once in BaseLayout.
 * All components fire toasts via sonner's imperative API:
 *   import { toast } from "sonner";
 *   toast.error("Something broke", { description: "..." });
 */
export function GlobalToaster() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!bg-zinc-900 !border !border-white/10 !text-zinc-100 !rounded-2xl !shadow-2xl",
          description: "!text-zinc-400",
          actionButton: "!bg-primary !text-black !font-bold",
          closeButton: "!bg-zinc-800 !border-white/10 !text-zinc-400",
          error: "!border-red-500/30 !bg-red-950/80",
          success: "!border-emerald-500/30 !bg-emerald-950/80",
        },
      }}
    />
  );
}
