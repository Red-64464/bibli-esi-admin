const easeIn = [0.46, 0, 0.7, 0.45];
const easeOut = [0.22, 0.78, 0.24, 1];

export const pageMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.44, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: 0.17, ease: easeIn } },
};

export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: easeOut } },
  exit: { opacity: 0, transition: { duration: 0.19, ease: easeIn } },
};

export const popoverMotion = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.27, ease: easeOut } },
  exit: { opacity: 0, y: -3, transition: { duration: 0.16, ease: easeIn } },
};

export const noticeMotion = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.31, ease: easeOut } },
  exit: { opacity: 0, x: 10, transition: { duration: 0.18, ease: easeIn } },
};
