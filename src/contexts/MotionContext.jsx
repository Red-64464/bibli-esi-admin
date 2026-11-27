import { createContext, useContext, useLayoutEffect, useState } from "react";
import { MotionConfig } from "motion/react";

const MotionContext = createContext(null);
const storageKey = "bibliesi-admin-motion";

export function AdminMotionProvider({ children }) {
  const [reduceMotion, setReduceMotion] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "reduced";
    } catch {
      return false;
    }
  });

  useLayoutEffect(() => {
    const preference = reduceMotion ? "reduced" : "full";
    document.documentElement.dataset.adminMotion = preference;
    try {
      localStorage.setItem(storageKey, preference);
    } catch {
      // The preference still applies while this page is open.
    }
  }, [reduceMotion]);

  return (
    <MotionContext.Provider value={{ reduceMotion, setReduceMotion }}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  );
}

export function useAdminMotion() {
  return useContext(MotionContext);
}
