import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { StoreProvider } from "./Store";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
      {/* Métricas de visitas por página, sin cookies ni datos personales.
          Como cada producto tiene su propia URL, el panel de Vercel muestra
          directamente cuáles son los más mirados. */}
      <Analytics />
    </StoreProvider>
  </StrictMode>,
);
