import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import "@pageant/ui/globals.css";
import { Toaster } from "sonner";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/admin">
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  </StrictMode>
);
