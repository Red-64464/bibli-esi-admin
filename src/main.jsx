import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";
import "./design.css";
import "./motion.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <LazyMotion features={domAnimation} strict>
            <App />
          </LazyMotion>
        </MotionConfig>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
