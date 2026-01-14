import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { offlineDb } from "@/offline/db";
import { isReminderDismissed, dismissReminder as dismissReminderStorage } from "@/lib/guestUser";

const REMINDER_THRESHOLD = 5;

export function useGuestWorkoutReminder() {
  const { isGuest, guestUserId } = useAuth();
  const [shouldShowReminder, setShouldShowReminder] = useState(false);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!isGuest || !guestUserId) {
      setShouldShowReminder(false);
      setIsChecking(false);
      return;
    }

    const checkWorkoutCount = async () => {
      try {
        const count = await offlineDb.workouts
          .where("user_id")
          .equals(guestUserId)
          .count();

        setWorkoutCount(count);

        const dismissed = isReminderDismissed();
        if (count >= REMINDER_THRESHOLD && !dismissed) {
          setShouldShowReminder(true);
        } else {
          setShouldShowReminder(false);
        }
      } catch (error) {
        console.error("[useGuestWorkoutReminder] Error checking workout count:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkWorkoutCount();
  }, [isGuest, guestUserId]);

  const dismissReminder = useCallback(() => {
    dismissReminderStorage();
    setShouldShowReminder(false);
  }, []);

  const recheckCount = useCallback(async () => {
    if (!isGuest || !guestUserId) return;

    try {
      const count = await offlineDb.workouts
        .where("user_id")
        .equals(guestUserId)
        .count();

      setWorkoutCount(count);

      const dismissed = isReminderDismissed();
      if (count >= REMINDER_THRESHOLD && !dismissed) {
        setShouldShowReminder(true);
      }
    } catch (error) {
      console.error("[useGuestWorkoutReminder] Error rechecking workout count:", error);
    }
  }, [isGuest, guestUserId]);

  return {
    shouldShowReminder,
    workoutCount,
    dismissReminder,
    recheckCount,
    isChecking,
    threshold: REMINDER_THRESHOLD,
  };
}
