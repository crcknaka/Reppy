import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export function AnimatedNumber({ value, duration = 600, suffix, prefix, decimals }: AnimatedNumberProps) {
  const animated = useAnimatedCounter(value, duration);
  const display = decimals !== undefined ? animated.toFixed(decimals) : animated;
  return <>{prefix}{display}{suffix}</>;
}
