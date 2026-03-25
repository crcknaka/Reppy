import * as React from "react";
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
const HAPTIC_PULSE_MS = 25;
const HAPTIC_PAUSE_MS = 20;
const MAX_HAPTIC_STEPS_PER_COMMIT = 10;

// Ruler constants
const RULER_HEIGHT = 14;
const TICK_GAP_PX = PIXELS_PER_STEP;

const toFiniteNumber = (value: string | number | undefined): number | null => {
  if (value === undefined || value === "") return null;
  let raw = typeof value === "string" ? value : String(value);
  // Strip whitespace used as digit-group separators (e.g. "1 234")
  raw = raw.replace(/\s/g, "");
  // If both comma and dot present, comma is a digit-group separator (e.g. "1,234.56")
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.replace(/,/g, "");
  } else {
    // Comma is a decimal separator (e.g. "2,5" → "2.5")
    raw = raw.replace(/,/g, ".");
  }
  const parsed = Number(raw);
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

// --- Ruler drawing ---
function drawRuler(
  canvas: HTMLCanvasElement,
  value: number,
  stepSize: number,
  isSwiping: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const centerX = w / 2;
  // How many steps from 0 to current value
  const stepsFromZero = value / stepSize;
  // Pixel offset of current value from ruler center
  const offsetPx = stepsFromZero * TICK_GAP_PX;

  // Draw ticks
  const ticksVisible = Math.ceil(w / TICK_GAP_PX) + 2;
  const startIndex = Math.floor(stepsFromZero - ticksVisible / 2);
  const endIndex = Math.ceil(stepsFromZero + ticksVisible / 2);

  const baseAlpha = isSwiping ? 0.5 : 0.25;

  for (let i = startIndex; i <= endIndex; i++) {
    const x = centerX + (i - stepsFromZero) * TICK_GAP_PX;
    if (x < -2 || x > w + 2) continue;

    const isMajor10 = i % 10 === 0;
    const isMajor5 = i % 5 === 0;

    let tickH: number;
    let tickAlpha: number;
    let tickWidth: number;

    if (isMajor10) {
      tickH = h * 0.85;
      tickAlpha = baseAlpha * 1.8;
      tickWidth = 1.5;
    } else if (isMajor5) {
      tickH = h * 0.6;
      tickAlpha = baseAlpha * 1.4;
      tickWidth = 1;
    } else {
      tickH = h * 0.35;
      tickAlpha = baseAlpha;
      tickWidth = 0.5;
    }

    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, h - tickH);
    ctx.strokeStyle = `rgba(150, 150, 150, ${tickAlpha})`;
    ctx.lineWidth = tickWidth;
    ctx.stroke();
  }

  // Center indicator — primary color
  const style = getComputedStyle(canvas);
  const primaryColor = style.getPropertyValue("--primary").trim();
  ctx.beginPath();
  ctx.moveTo(centerX, h);
  ctx.lineTo(centerX, 0);
  ctx.strokeStyle = primaryColor ? `hsl(${primaryColor})` : "hsl(24, 100%, 50%)";
  ctx.lineWidth = 2;
  ctx.globalAlpha = isSwiping ? 0.9 : 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

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
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
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

    // Redraw ruler whenever value or swiping state changes
    const redrawRuler = React.useCallback(() => {
      const canvas = canvasRef.current;
      const input = inputRef.current;
      if (!canvas || !input) return;
      const val = toFiniteNumber(input.value) ?? 0;
      drawRuler(canvas, val, resolvedSwipeStep, swipeStateRef.current !== null);
    }, [resolvedSwipeStep]);

    // Observe input value changes for ruler sync
    React.useEffect(() => {
      if (!swipeEnabled) return;
      const input = inputRef.current;
      if (!input) return;

      const handler = () => redrawRuler();
      input.addEventListener("input", handler);
      // Initial draw
      redrawRuler();
      return () => input.removeEventListener("input", handler);
    }, [swipeEnabled, redrawRuler]);

    // Redraw on swiping state change
    React.useEffect(() => {
      redrawRuler();
    }, [isSwiping, redrawRuler]);

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

        const currentValue = toFiniteNumber(input.value) ?? NaN;
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
        redrawRuler();
      },
      [decimals, maxValue, minValue, resolvedSwipeStep, triggerStepHaptic, redrawRuler],
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

    return (
      <div className="relative">
        <input
          type={type}
          step={step}
          min={min}
          max={max}
          lang={resolvedLang}
          className={cn(
            "flex h-10 w-full border border-input bg-background px-4 py-2 text-base ring-offset-background transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            type === "number" && "appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            swipeEnabled ? "select-none rounded-t-xl rounded-b-none border-b-0 text-center" : "rounded-xl",
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

        {/* Ruler strip below input */}
        {swipeEnabled && (
          <div
            className={cn(
              "w-full overflow-hidden rounded-b-xl border border-t-0 border-input bg-background transition-colors duration-200",
              isSwiping && "border-ring",
            )}
            style={{ height: RULER_HEIGHT }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ display: "block" }}
            />
          </div>
        )}

      </div>
    );
  },
);

SwipeNumberInput.displayName = "SwipeNumberInput";

export { SwipeNumberInput };
