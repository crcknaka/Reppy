import { motion, AnimatePresence, MotionConfig, type Variants } from "framer-motion";
import { useAnimationsEnabled } from "@/hooks/useAnimationsEnabled";

// Standard animation presets
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};

// Page transition preset
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

// Stagger container — children animate one by one
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

// Stagger item — used inside staggerContainer
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

// Default transition
export const defaultTransition = {
  duration: 0.25,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

// Spring transition for interactive elements
export const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

// Provider that disables all Framer Motion animations when toggle is off
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { animationsEnabled } = useAnimationsEnabled();
  return (
    <MotionConfig
      transition={animationsEnabled ? undefined : { duration: 0 }}
      reducedMotion={animationsEnabled ? "never" : "always"}
    >
      {children}
    </MotionConfig>
  );
}

// Hook to check if animations are currently enabled
export function useMotionEnabled() {
  const { animationsEnabled } = useAnimationsEnabled();
  return animationsEnabled;
}

export { motion, AnimatePresence };
