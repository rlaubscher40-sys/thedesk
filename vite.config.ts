import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { completeBrowserLicences } from "./scripts/lib/browserLicences";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "desk-complete-browser-licences",
      enforce: "post",
      generateBundle: {
        order: "post",
        handler(_, bundle) {
          const notice = bundle["third-party-licenses.txt"];
          if (!notice || notice.type !== "asset" || typeof notice.source !== "string")
            throw new Error("Browser licence notices were not generated");
          notice.source = completeBrowserLicences(notice.source);
        },
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    // Keep licences for the actual bundled (including transitive) browser code.
    license: { fileName: "third-party-licenses.txt" },
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    fs: { strict: true, deny: ["**/.*"] },
  },
});
