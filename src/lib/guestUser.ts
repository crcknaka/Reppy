// Guest User utilities for managing guest mode

export const GUEST_USER_PREFIX = "guest_";
export const GUEST_USER_STORAGE_KEY = "reppy_guest_user_id";
export const GUEST_REMINDER_DISMISSED_KEY = "reppy_guest_reminder_dismissed";

/**
 * Get or create a guest user ID
 * Creates a new UUID with guest_ prefix if none exists
 */
export function getOrCreateGuestUserId(): string {
  let guestId = localStorage.getItem(GUEST_USER_STORAGE_KEY);
  if (!guestId) {
    guestId = `${GUEST_USER_PREFIX}${crypto.randomUUID()}`;
    localStorage.setItem(GUEST_USER_STORAGE_KEY, guestId);
  }
  return guestId;
}

/**
 * Check if a user ID belongs to a guest user
 */
export function isGuestUserId(userId: string): boolean {
  return userId.startsWith(GUEST_USER_PREFIX);
}

/**
 * Get the stored guest user ID without creating one
 */
export function getGuestUserId(): string | null {
  return localStorage.getItem(GUEST_USER_STORAGE_KEY);
}

/**
 * Clear all guest-related data from localStorage
 * Called when guest converts to authenticated user or logs out
 */
export function clearGuestData(): void {
  localStorage.removeItem(GUEST_USER_STORAGE_KEY);
  localStorage.removeItem(GUEST_REMINDER_DISMISSED_KEY);
}

/**
 * Check if the registration reminder has been dismissed
 */
export function isReminderDismissed(): boolean {
  return localStorage.getItem(GUEST_REMINDER_DISMISSED_KEY) === "true";
}

/**
 * Mark the registration reminder as dismissed
 */
export function dismissReminder(): void {
  localStorage.setItem(GUEST_REMINDER_DISMISSED_KEY, "true");
}
