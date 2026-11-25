import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // The Cloudflare plugin runs the server build inside the Workers runtime.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    // Must come before viteReact().
    tanstackStart(),
    viteReact(),
  ],
});
