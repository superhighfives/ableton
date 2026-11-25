import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "sounds",
    compatibilityDate: "2026-11-23",
    entrypoint: "@tanstack/react-start/server-entry",
    domains: ["sounds.charliegleason.com"],
    observability: {
      enabled: true,
    },
  },
});
