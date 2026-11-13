import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
          if (id.includes("questions-ctsi") || id.includes("final-cram-ctsi")) return "bank-ctsi";
          if (id.includes("questions-ctsd") || id.includes("final-cram-ctsd")) return "bank-ctsd";
          if (id.includes("questions.generated") || id.includes("final-cram.generated")) return "bank-cts";
          return undefined;
        },
      },
    },
  },
});
