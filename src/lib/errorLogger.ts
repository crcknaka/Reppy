import { supabase } from "@/integrations/supabase/client";

type LogLevel = "error" | "warn" | "info";

interface LogEntry {
  level: LogLevel;
  message: string;
  stack?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

// Rate limiting: max 10 errors per session
const MAX_LOGS_PER_SESSION = 10;
let sessionLogCount = 0;

// Deduplication: don't log same error twice in 5 seconds
const recentErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000;

// Batch queue for sending logs
const logQueue: LogEntry[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 2000;

function getErrorKey(entry: LogEntry): string {
  return `${entry.level}:${entry.message}:${entry.stack?.slice(0, 100) || ""}`;
}

function isDuplicate(entry: LogEntry): boolean {
  const key = getErrorKey(entry);
  const lastTime = recentErrors.get(key);
  const now = Date.now();

  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    return true;
  }

  recentErrors.set(key, now);
  // Clean old entries
  for (const [k, time] of recentErrors.entries()) {
    if (now - time > DEDUP_WINDOW_MS) {
      recentErrors.delete(k);
    }
  }

  return false;
}

async function flushLogs(): Promise<void> {
  if (logQueue.length === 0) return;

  const logsToSend = [...logQueue];
  logQueue.length = 0;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Skip logging for unauthenticated users (guests)
    // RLS policies require authenticated user
    if (!user) {
      return;
    }

    const logs = logsToSend.map((entry) => ({
      user_id: user.id,
      level: entry.level,
      message: entry.message.slice(0, 1000), // Limit message length
      stack: entry.stack?.slice(0, 5000) || null, // Limit stack length
      url: entry.url || window.location.href,
      user_agent: navigator.userAgent.slice(0, 500),
      metadata: entry.metadata || {},
    }));

    await supabase.from("app_logs").insert(logs);
  } catch {
    // Silently fail - we don't want logging errors to cause more errors
    console.warn("[ErrorLogger] Failed to send logs");
  }
}

function scheduleFlush(): void {
  if (flushTimeout) return;

  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushLogs();
  }, FLUSH_DELAY_MS);
}

function log(entry: LogEntry): void {
  // Check rate limit
  if (sessionLogCount >= MAX_LOGS_PER_SESSION) {
    return;
  }

  // Check for duplicates
  if (isDuplicate(entry)) {
    return;
  }

  sessionLogCount++;
  logQueue.push(entry);
  scheduleFlush();
}

export const errorLogger = {
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const stack = error instanceof Error ? error.stack : undefined;
    log({
      level: "error",
      message: error instanceof Error ? `${message}: ${error.message}` : message,
      stack,
      metadata,
    });
  },

  warn(message: string, metadata?: Record<string, unknown>): void {
    log({
      level: "warn",
      message,
      metadata,
    });
  },

  info(message: string, metadata?: Record<string, unknown>): void {
    log({
      level: "info",
      message,
      metadata,
    });
  },

  // For API/fetch errors
  apiError(url: string, status: number, statusText: string, metadata?: Record<string, unknown>): void {
    log({
      level: "error",
      message: `API Error: ${status} ${statusText}`,
      url,
      metadata: { ...metadata, status, statusText },
    });
  },

  // Force flush (e.g., before page unload)
  flush(): Promise<void> {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    return flushLogs();
  },

  // Reset session count (for testing)
  resetSession(): void {
    sessionLogCount = 0;
    recentErrors.clear();
  },
};

// Flush logs before page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    errorLogger.flush();
  });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      errorLogger.flush();
    }
  });
}
