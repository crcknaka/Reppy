import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Check, Timer, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TimerMode = "stopwatch" | "countdown";

interface ExerciseTimerProps {
  onSave: (seconds: number) => void;
  onCancel: () => void;
}

export function ExerciseTimer({ onSave, onCancel }: ExerciseTimerProps) {
  const [mode, setMode] = useState<TimerMode>("stopwatch");
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [countdownTarget, setCountdownTarget] = useState(60); // Default 60 seconds
  const [showResult, setShowResult] = useState(false);
  const [finalSeconds, setFinalSeconds] = useState(0);

  const intervalRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Request Wake Lock to prevent screen from turning off
  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        console.log("Wake Lock activated");
      } catch (err) {
        console.log("Wake Lock failed:", err);
      }
    }
  }, []);

  // Release Wake Lock
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log("Wake Lock released");
    }
  }, []);

  // Handle visibility change (re-request wake lock when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isRunning) {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isRunning, requestWakeLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      requestWakeLock();

      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;
      }

      intervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);

        if (mode === "stopwatch") {
          setSeconds(elapsed);
        } else {
          const remaining = countdownTarget - elapsed;
          if (remaining <= 0) {
            setSeconds(0);
            handleStop();
          } else {
            setSeconds(remaining);
          }
        }
      }, 100); // Update every 100ms for smoother display
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      releaseWakeLock();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, mode, countdownTarget, requestWakeLock, releaseWakeLock]);

  const handleStart = () => {
    if (mode === "countdown" && countdownTarget <= 0) return;

    if (mode === "countdown") {
      setSeconds(countdownTarget);
    }

    startTimeRef.current = null;
    pausedTimeRef.current = mode === "countdown" ? 0 : seconds;
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    pausedTimeRef.current = mode === "stopwatch" ? seconds : countdownTarget - seconds;
  };

  const handleStop = () => {
    setIsRunning(false);

    // Calculate final time
    let result: number;
    if (mode === "stopwatch") {
      result = seconds;
    } else {
      // For countdown, calculate how much time actually passed
      result = countdownTarget - seconds;
    }

    setFinalSeconds(result);
    setShowResult(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setSeconds(mode === "countdown" ? countdownTarget : 0);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    setShowResult(false);
  };

  const handleSaveResult = () => {
    onSave(finalSeconds);
  };

  const handleModeChange = (newMode: TimerMode) => {
    if (isRunning) return;
    setMode(newMode);
    setSeconds(newMode === "countdown" ? countdownTarget : 0);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
  };

  // Result screen
  if (showResult) {
    return (
      <div className="flex flex-col items-center gap-6 py-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Результат</p>
          <div className="text-6xl font-bold text-primary tabular-nums">
            {formatTime(finalSeconds)}
          </div>
          <p className="text-lg text-muted-foreground mt-2">
            {finalSeconds} сек
          </p>
        </div>

        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Заново
          </Button>
          <Button
            className="flex-1"
            onClick={handleSaveResult}
          >
            <Check className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg w-full">
        <button
          onClick={() => handleModeChange("stopwatch")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all",
            mode === "stopwatch"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          disabled={isRunning}
        >
          <ArrowUp className="h-4 w-4" />
          Секундомер
        </button>
        <button
          onClick={() => handleModeChange("countdown")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all",
            mode === "countdown"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          disabled={isRunning}
        >
          <ArrowDown className="h-4 w-4" />
          Обратный
        </button>
      </div>

      {/* Countdown Target Input */}
      {mode === "countdown" && !isRunning && seconds === countdownTarget && (
        <div className="flex items-center gap-2 w-full">
          <span className="text-sm text-muted-foreground">Цель:</span>
          <Input
            type="number"
            inputMode="numeric"
            value={countdownTarget}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setCountdownTarget(Math.min(3600, Math.max(1, val)));
              setSeconds(Math.min(3600, Math.max(1, val)));
            }}
            className="w-24 text-center"
            min={1}
            max={3600}
          />
          <span className="text-sm text-muted-foreground">сек</span>

          {/* Quick presets */}
          <div className="flex gap-1 ml-auto">
            {[30, 60, 90, 120].map((preset) => (
              <Button
                key={preset}
                variant="outline"
                size="sm"
                className="px-2 h-8 text-xs"
                onClick={() => {
                  setCountdownTarget(preset);
                  setSeconds(preset);
                }}
              >
                {preset}с
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Timer Display */}
      <div className="relative">
        <div className={cn(
          "text-7xl font-bold tabular-nums transition-colors",
          isRunning ? "text-primary" : "text-foreground"
        )}>
          {formatTime(seconds)}
        </div>

        {/* Animated indicator when running */}
        {isRunning && (
          <div className="absolute -right-8 top-1/2 -translate-y-1/2">
            <Timer className="h-6 w-6 text-primary animate-pulse" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3 w-full">
        {!isRunning ? (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
            >
              Отмена
            </Button>
            <Button
              className="flex-1"
              onClick={handleStart}
              disabled={mode === "countdown" && countdownTarget <= 0}
            >
              <Play className="h-4 w-4 mr-2" />
              {seconds > 0 && mode === "stopwatch" ? "Продолжить" : "Старт"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handlePause}
            >
              <Pause className="h-4 w-4 mr-2" />
              Пауза
            </Button>
            <Button
              className="flex-1"
              onClick={handleStop}
            >
              <Check className="h-4 w-4 mr-2" />
              Стоп
            </Button>
          </>
        )}
      </div>

      {/* Reset button when paused */}
      {!isRunning && seconds > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Сбросить
        </Button>
      )}

      {/* Wake Lock indicator */}
      {isRunning && (
        <p className="text-xs text-muted-foreground text-center">
          Экран не выключится пока таймер работает
        </p>
      )}
    </div>
  );
}
