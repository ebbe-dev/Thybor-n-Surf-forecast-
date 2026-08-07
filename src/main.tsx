import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";

// Uden dette hænger en ny version i "venteposition" til NÆSTE åbning.
// Med immediate + autoUpdate genindlæses appen selv, når opdateringen er
// hentet og aktiveret.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
