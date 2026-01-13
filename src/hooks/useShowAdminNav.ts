import { useEffect, useState } from "react";

const STORAGE_KEY = "fittrack-show-admin-nav";

export function useShowAdminNav() {
  const [showAdminNav, setShowAdminNavState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default to true (show admin nav)
      return stored === null ? true : stored === "true";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, showAdminNav.toString());
  }, [showAdminNav]);

  const setShowAdminNav = (show: boolean) => {
    setShowAdminNavState(show);
  };

  return {
    showAdminNav,
    setShowAdminNav,
  };
}
