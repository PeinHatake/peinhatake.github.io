import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // base "./" giúp chạy ổn trên cả:
  // - https://username.github.io/
  // - https://username.github.io/repository-name/
  base: "./"
});
