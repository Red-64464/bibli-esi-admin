import { forwardRef } from "react";
import { createPortal } from "react-dom";
import { useIsPresent } from "motion/react";
import * as m from "motion/react-m";
import { backdropMotion } from "../lib/motion";

const MotionOverlay = forwardRef(function MotionOverlay({ children, ...props }, ref) {
  const isPresent = useIsPresent();

  return createPortal(
    <m.div
      {...props}
      {...backdropMotion}
      ref={ref}
      inert={isPresent ? undefined : ""}
      data-motion-overlay=""
    >
      {children}
    </m.div>,
    document.body,
  );
});

export default MotionOverlay;
