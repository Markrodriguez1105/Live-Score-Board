import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toast } from "@pageant/ui";
import App from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/tabulator">
      <Toast><App /></Toast>
    </BrowserRouter>
  </StrictMode>
);
