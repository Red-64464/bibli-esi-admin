import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, domAnimation } from "motion/react";
import { AdminMotionProvider } from "./contexts/MotionContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";
import "./design.css";
import "./motion.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AdminMotionProvider>
          <LazyMotion features={domAnimation} strict>
            <App />
          </LazyMotion>
        </AdminMotionProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
