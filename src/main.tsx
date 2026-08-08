import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter as Router } from "react-router";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import "./i18n/config";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import LanguageFontHandler from "./components/common/LanguageFontHandler.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppWrapper>
            <LanguageFontHandler />
            <App />
          </AppWrapper>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  </StrictMode>,
);
