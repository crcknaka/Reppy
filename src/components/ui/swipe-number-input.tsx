import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SwipeNumberInputProps = React.ComponentProps<"input"> & {
  swipeStep?: string | number;
};

type SwipeState = {
  pointerId: number;
  lastX: number;
  lastTimestamp: number;
  velocityPxPerMs: number;
  remainderPx: number;
};

const PIXELS_PER_STEP = 22;
const INERTIA_MIN_VELOCITY = 0.04;
const INERTIA_STOP_VELOCITY = 0.002;
const INERTIA_FRICTION_PER_MS = 0.993;
const INERTIA_RELEASE_IDLE_CUTOFF_MS = 120;
const HAPTIC_PULSE_MS = 10;
const HAPTIC_PAUSE_MS = 12;
const MAX_HAPTIC_STEPS_PER_COMMIT = 10;

const toFiniteNumber = (value: string | number | undefined): number | null => {
  if (value === undefined || value === "") return null;
  const parsed = Number(typeof value === "string" ? value.replace(/,/g, ".") : value);
  return Number.isFinite(parsed) ? parsed : null;
};

const countDecimals = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const asString = value.toString().toLowerCase();
  if (asString.includes("e-")) {
    const [, exponent] = asString.split("e-");
    return Number(exponent) || 0;
  }

  const [, decimalPart] = asString.split(".");
  return decimalPart?.length ?? 0;
};

const getStepValue = (step: string | number | undefined): number => {
  if (step === "any") return 1;
  const parsed = Number(step);
  if (!Number.isFinite(parsed) || parsed === 0) return 1;
  return parsed;
};

const clamp = (value: number, min: number | null, max: number | null): number => {
  if (min !== null && value < min) return min;
  if (max !== null && value > max) return max;
  return value;
};

const applyNativeInputValue = (input: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const SwipeNumberInput = React.forwardRef<HTMLInputElement, SwipeNumberInputProps>(
  (
    {
      className,
      type = "text",
      step,
      swipeStep,
      min,
      max,
      disabled,
      readOnly,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      style,
      lang,
      ...props
    },
    forwardedRef,
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const swipeStateRef = React.useRef<SwipeState | null>(null);
    const inertiaFrameRef = React.useRef<number | null>(null);
    const inertiaVelocityRef = React.useRef(0);
    const inertiaLastTsRef = React.useRef(0);
    const inertiaRemainderRef = React.useRef(0);

    const [isSwiping, setIsSwiping] = React.useState(false);

    const swipeEnabled = type === "number" && !disabled && !readOnly;
    const resolvedLang = type === "number" ? (lang ?? "en-US") : lang;

    const resolvedSwipeStep = React.useMemo(
      () => getStepValue(swipeStep ?? step),
      [swipeStep, step],
    );
    const decimals = React.useMemo(() => countDecimals(resolvedSwipeStep), [resolvedSwipeStep]);
    const minValue = React.useMemo(() => toFiniteNumber(min), [min]);
    const maxValue = React.useMemo(() => toFiniteNumber(max), [max]);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const stopInertia = React.useCallback(() => {
      if (inertiaFrameRef.current !== null) {
        cancelAnimationFrame(inertiaFrameRef.current);
        inertiaFrameRef.current = null;
      }
      inertiaVelocityRef.current = 0;
      inertiaLastTsRef.current = 0;
      inertiaRemainderRef.current = 0;
    }, []);

    React.useEffect(() => stopInertia, [stopInertia]);

    const triggerStepHaptic = React.useCallback((stepCount: number) => {
      if (stepCount <= 0) return;
      if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;

      const pulses = Math.min(stepCount, MAX_HAPTIC_STEPS_PER_COMMIT);
      if (pulses === 1) {
        navigator.vibrate(HAPTIC_PULSE_MS);
        return;
      }

      const pattern: number[] = [];
      for (let i = 0; i < pulses; i += 1) {
        pattern.push(HAPTIC_PULSE_MS);
        if (i < pulses - 1) {
          pattern.push(HAPTIC_PAUSE_MS);
        }
      }

      navigator.vibrate(pattern);
    }, []);

    const commitStepDelta = React.useCallback(
      (stepDelta: number) => {
        const input = inputRef.current;
        if (!input || stepDelta === 0) return;

        const currentValue = Number(input.value.replace(/,/g, "."));
        const origin = minValue ?? 0;
        const base = Number.isFinite(currentValue) ? currentValue : origin;
        const offsetFromOrigin = (base - origin) / resolvedSwipeStep;
        const epsilon = Math.max(1e-9, resolvedSwipeStep * 1e-6);

        const targetGridIndex =
          stepDelta > 0
            ? Math.floor(offsetFromOrigin + epsilon) + stepDelta
            : Math.ceil(offsetFromOrigin - epsilon) + stepDelta;

        const snapped = origin + targetGridIndex * resolvedSwipeStep;
        const next = clamp(snapped, minValue, maxValue);
        const rounded = Number(next.toFixed(decimals));
        const baseRounded = Number(base.toFixed(decimals));

        const movedSteps = Math.round(
          Math.abs((rounded - baseRounded) / resolvedSwipeStep),
        );

        applyNativeInputValue(input, rounded.toString());
        triggerStepHaptic(movedSteps);
      },
      [decimals, maxValue, minValue, resolvedSwipeStep, triggerStepHaptic],
    );

    const onInertiaFrame = React.useCallback(
      (timestamp: number) => {
        const dt = inertiaLastTsRef.current > 0 ? timestamp - inertiaLastTsRef.current : 16;
        inertiaLastTsRef.current = timestamp;

        const decay = Math.pow(INERTIA_FRICTION_PER_MS, dt);
        inertiaVelocityRef.current *= decay;

        if (Math.abs(inertiaVelocityRef.current) < INERTIA_STOP_VELOCITY) {
          stopInertia();
          return;
        }

        const deltaPx = inertiaVelocityRef.current * dt;
        inertiaRemainderRef.current += deltaPx;

        const steps = Math.trunc(inertiaRemainderRef.current / PIXELS_PER_STEP);
        if (steps !== 0) {
          inertiaRemainderRef.current -= steps * PIXELS_PER_STEP;
          commitStepDelta(steps);
        }

        inertiaFrameRef.current = requestAnimationFrame(onInertiaFrame);
      },
      [commitStepDelta, stopInertia],
    );

    const startInertia = React.useCallback(
      (initialVelocity: number) => {
        stopInertia();
        if (Math.abs(initialVelocity) < INERTIA_MIN_VELOCITY) return;

        inertiaVelocityRef.current = initialVelocity;
        inertiaLastTsRef.current = 0;
        inertiaRemainderRef.current = 0;
        inertiaFrameRef.current = requestAnimationFrame(onInertiaFrame);
      },
      [onInertiaFrame, stopInertia],
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLInputElement>) => {
      onPointerDown?.(event);
      if (event.defaultPrevented) return;
      if (!swipeEnabled) return;

      stopInertia();

      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      target.focus();

      swipeStateRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastTimestamp: event.timeStamp,
        velocityPxPerMs: 0,
        remainderPx: 0,
      };

      setIsSwiping(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLInputElement>) => {
      onPointerMove?.(event);
      if (event.defaultPrevented) return;

      const state = swipeStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;

      const dx = event.clientX - state.lastX;
      const dt = Math.max(1, event.timeStamp - state.lastTimestamp);

      state.lastX = event.clientX;
      state.lastTimestamp = event.timeStamp;

      const instantaneousVelocity = -dx / dt;
      state.velocityPxPerMs = state.velocityPxPerMs * 0.75 + instantaneousVelocity * 0.25;

      state.remainderPx -= dx;

      const steps = Math.trunc(state.remainderPx / PIXELS_PER_STEP);
      if (steps !== 0) {
        state.remainderPx -= steps * PIXELS_PER_STEP;
        commitStepDelta(steps);
      }
    };

    const handlePointerEnd = (event: React.PointerEvent<HTMLInputElement>) => {
      if (event.type === "pointerup") {
        onPointerUp?.(event);
      } else {
        onPointerCancel?.(event);
      }
      if (event.defaultPrevented) return;

      const state = swipeStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;

      swipeStateRef.current = null;
      setIsSwiping(false);

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // no-op
      }

      const idleBeforeReleaseMs = event.timeStamp - state.lastTimestamp;
      if (idleBeforeReleaseMs <= INERTIA_RELEASE_IDLE_CUTOFF_MS) {
        startInertia(state.velocityPxPerMs);
      }
    };

    const handleChevronStep = (stepDelta: number) => {
      if (!swipeEnabled) return;
      stopInertia();
      inputRef.current?.focus();
      commitStepDelta(stepDelta);
    };

    return (
      <div className="relative">
        <input
          type={type}
          step={step}
          min={min}
          max={max}
          lang={resolvedLang}
          className={cn(
            "flex h-10 w-full rounded-xl border border-input bg-background px-4 py-2 text-base ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            type === "number" && "appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            swipeEnabled && "select-none pr-11 pl-11",
            isSwiping && "border-ring ring-2 ring-ring/30",
            className,
          )}
          style={swipeEnabled ? { ...style, touchAction: "pan-y" } : style}
          ref={setRefs}
          disabled={disabled}
          readOnly={readOnly}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          {...props}
        />

        {swipeEnabled && (
          <>
            <button
              type="button"
              aria-label="Decrement value"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => handleChevronStep(-1)}
              className={cn(
                "group absolute inset-y-0 left-0 grid w-10 place-items-center rounded-l-xl text-muted-foreground",
                "transition-all duration-150 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSwiping && "text-foreground",
              )}
            >
              <span className="rounded-md p-1 transition-all duration-150 group-hover:bg-muted/60 group-active:scale-95 group-active:bg-muted/80">
                <ChevronLeft className="h-4 w-4" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Increment value"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => handleChevronStep(1)}
              className={cn(
                "group absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-xl text-muted-foreground",
                "transition-all duration-150 hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSwiping && "text-foreground",
              )}
            >
              <span className="rounded-md p-1 transition-all duration-150 group-hover:bg-muted/60 group-active:scale-95 group-active:bg-muted/80">
                <ChevronRight className="h-4 w-4" />
              </span>
            </button>
          </>
        )}
      </div>
    );
  },
);

SwipeNumberInput.displayName = "SwipeNumberInput";

export { SwipeNumberInput };
