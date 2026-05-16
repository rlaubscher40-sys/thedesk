import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/lib/theme";

/** Sonner toaster that follows our theme. */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style:
          theme === "dark"
            ? {
                background: "oklch(0.17 0.018 260)",
                color: "oklch(0.93 0.005 80)",
                border: "1px solid oklch(1 0 0 / 9%)",
              }
            : {
                background: "oklch(1 0 0)",
                color: "oklch(0.18 0.02 260)",
                border: "1px solid oklch(0 0 0 / 10%)",
              },
      }}
    />
  );
}
