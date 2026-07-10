import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

if (import.meta.env.DEV) {
  (window as any).__errs = [];
  window.addEventListener("error", (e) =>
    (window as any).__errs.push(String(e.error?.stack || e.message).split("\n").slice(0, 6).join(" | "))
  );
  window.addEventListener("unhandledrejection", (e) =>
    (window as any).__errs.push("rej: " + String((e.reason as any)?.stack || e.reason).split("\n").slice(0, 6).join(" | "))
  );
}

const app = mount(App, { target: document.getElementById("app")! });

export default app;
