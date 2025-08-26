import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./global.css";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";

// Simple page fade-in animation on every load
setTimeout(() => {
  document.body.classList.add("page-ready");
}, 100);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <App />
      </ThemeProvider>
    </HashRouter>
  </StrictMode>
);
