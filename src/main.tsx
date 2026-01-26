import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BackgroundProvider } from "./contexts/BackgroundContext";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BackgroundProvider>
      <App />
    </BackgroundProvider>
  </React.StrictMode>
);
