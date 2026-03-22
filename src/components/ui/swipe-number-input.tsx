import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SwipeNumberInputProps = React.ComponentProps<"input">;

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

    const resolvedStep = React.useMemo(() => getStepValue(step), [step]);
    const decimals = React.useMemo(() => countDecimals(resolvedStep), [resolvedStep]);
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

    const commitStepDelta = React.useCallback(
      (stepDelta: number) => {
        const input = inputRef.current;
        if (!input || stepDelta === 0) return;

        const currentValue = Number(input.value.replace(/,/g, "."));
        const fallbackBase = minValue ?? 0;
        const base = Number.isFinite(currentValue) ? currentValue : fallbackBase;

        const next = clamp(base + stepDelta * resolvedStep, minValue, maxValue);
        const rounded = Number(next.toFixed(decimals));

        applyNativeInputValue(input, rounded.toString());
      },
      [decimals, maxValue, minValue, resolvedStep],
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

      const instantaneousVelocity = dx / dt;
      state.velocityPxPerMs = state.velocityPxPerMs * 0.75 + instantaneousVelocity * 0.25;

      state.remainderPx += dx;

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
            swipeEnabled && "select-none pr-10 pl-10",
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
                "absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-all duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSwiping && "text-foreground -translate-x-0.5",
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Increment value"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => handleChevronStep(1)}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-all duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSwiping && "text-foreground translate-x-0.5",
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    );
  },
);

SwipeNumberInput.displayName = "SwipeNumberInput";

export { SwipeNumberInput };
