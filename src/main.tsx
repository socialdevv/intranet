import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./styles/globals.css";
import { ToastProvider } from "@/contexts/toast-context";
import { AuthProvider } from "@/contexts/auth-context";
import { DataProvider } from "@/contexts/data-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { LeadWidgetProvider } from "@/contexts/lead-widget-context";
import ToastContainer from "@/components/toast-container";
import App from "@/App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
      <ToastProvider>
          <DataProvider>
            <AuthProvider>
            <LeadWidgetProvider>
              <App />
              <ToastContainer />
            </LeadWidgetProvider>
            </AuthProvider>
          </DataProvider>
      </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>
);
