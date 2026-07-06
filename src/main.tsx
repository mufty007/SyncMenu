import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
if (supabaseUrl) {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = new URL(supabaseUrl).origin;
  document.head.appendChild(link);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
