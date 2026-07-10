import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { writeFileSync } from "node:fs";

const capture: Plugin = {
  name: "capture",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/__cap", (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const data = body.replace(/^data:image\/\w+;base64,/, "");
        writeFileSync("cap.jpg", Buffer.from(data, "base64"));
        res.end("ok");
      });
    });
  },
};

export default defineConfig({
  base: "./",
  plugins: [svelte(), tailwindcss(), capture],
});
