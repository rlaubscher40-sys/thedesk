/** Sonner toaster that follows our theme. */
import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/lib/theme";

export function Toaster() {
  // Use resolvedTheme so "system" mode renders the right toaster too —
  // sonner's own theme prop only takes "dark" | "light" | "system" but
  // we pass the resolved binary so the inline style colours line up.
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--color-toast-bg)",
          color: "var(--color-fg)",
          border: "1px solid var(--color-border)",
        },
      }}
    />
  );
}
