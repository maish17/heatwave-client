// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/index.css";
import "./styles/fonts.css";
import App from "./App.js";
import InfoPage from "./pages/InfoPage"; // <- add

const container = document.getElementById("root");
if (!container) throw new Error("Root element (#root) not found");

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/info" element={<InfoPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
