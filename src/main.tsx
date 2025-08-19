import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "./styles/fonts.css";
import App from "./App.js";

const container = document.getElementById("root");
if (!container) throw new Error("Root element (#root) not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
