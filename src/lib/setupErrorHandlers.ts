import { errorLogger } from "./errorLogger";

let isSetup = false;

export function setupGlobalErrorHandlers(): void {
  if (isSetup) return;
  isSetup = true;

  // Handle uncaught JavaScript errors
  window.onerror = (message, source, lineno, colno, error) => {
    errorLogger.error(
      `Uncaught Error: ${message}`,
      error,
      {
        source,
        lineno,
        colno,
      }
    );
    // Don't prevent default handling
    return false;
  };

  // Handle unhandled Promise rejections
  window.onunhandledrejection = (event) => {
    const reason = event.reason;

    // Get error details
    const message = reason instanceof Error
      ? reason.message
      : String(reason);

    const stack = reason instanceof Error
      ? reason.stack
      : undefined;

    errorLogger.error(
      `Unhandled Promise Rejection: ${message}`,
      reason instanceof Error ? reason : undefined,
      {
        type: "unhandledrejection",
      }
    );
  };

  // Intercept fetch to log API errors
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);

      // Log 4xx and 5xx errors
      if (!response.ok && response.status >= 400) {
        const url = typeof args[0] === "string"
          ? args[0]
          : args[0] instanceof Request
            ? args[0].url
            : String(args[0]);

        // Don't log errors for log insertion itself (prevent infinite loop)
        if (!url.includes("app_logs")) {
          errorLogger.apiError(url, response.status, response.statusText);
        }
      }

      return response;
    } catch (error) {
      // Network errors
      const url = typeof args[0] === "string"
        ? args[0]
        : args[0] instanceof Request
          ? args[0].url
          : String(args[0]);

      // Don't log errors for log insertion itself
      if (!url.includes("app_logs")) {
        errorLogger.error(`Network Error: ${url}`, error instanceof Error ? error : undefined, {
          type: "network",
        });
      }

      throw error;
    }
  };

  console.log("[ErrorHandlers] Global error handlers initialized");
}
