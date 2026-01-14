import { ReactNode, useMemo } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TrendingUp, ListPlus, LogOut, Activity, Settings, Users, Crown, LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { usePendingRequestsCount } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { useShowAdminNav } from "@/hooks/useShowAdminNav";
import { GuestRegistrationReminder } from "@/components/GuestRegistrationReminder";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";
import { GuestDataMigrationDialog } from "@/components/GuestDataMigrationDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  isAdmin?: boolean;
}

const baseNavItems: NavItem[] = [
  { to: "/", icon: Activity, labelKey: "nav.workouts" },
  { to: "/progress", icon: TrendingUp, labelKey: "nav.progress" },
  { to: "/friends", icon: Users, labelKey: "nav.friends" },
  { to: "/exercises", icon: ListPlus, labelKey: "nav.exercises" },
];

const adminNavItem: NavItem = { to: "/admin", icon: Crown, labelKey: "nav.admin", isAdmin: true };
const settingsNavItem: NavItem = { to: "/settings", icon: Settings, labelKey: "nav.settings" };

export default function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const { signOut, isGuest, showMigrationDialog, pendingMigrationWorkoutCount, confirmMigration, discardGuestData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/logo-white.png" : "/logo-black.png";
  const { data: pendingCount = 0 } = usePendingRequestsCount();
  const hasPendingRequests = pendingCount > 0 && !isGuest;
  const { data: profile } = useProfile();
  const { showAdminNav } = useShowAdminNav();

  // Build nav items based on admin status and settings
  const navItems = useMemo(() => {
    const items = [...baseNavItems];
    // Add admin nav item before settings if user is admin and has it enabled
    if (profile?.is_admin && showAdminNav) {
      items.push(adminNavItem);
    }
    items.push(settingsNavItem);
    return items;
  }, [profile?.is_admin, showAdminNav]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Guest Registration Reminder Dialog */}
      <GuestRegistrationReminder />

      {/* Guest Data Migration Dialog */}
      <GuestDataMigrationDialog
        open={showMigrationDialog}
        guestWorkoutCount={pendingMigrationWorkoutCount}
        onMigrate={confirmMigration}
        onDiscard={discardGuestData}
      />

      {/* Email Verification Banner - sticky at top, full width on mobile, offset on desktop */}
      <div className="md:ml-64 sticky top-0 z-50">
        <EmailVerificationBanner />
      </div>

      {/* Main Content */}
      <main className="flex-1 pb-24 md:pb-8 md:ml-64">
        <div className="container max-w-3xl py-6 md:py-8 overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 md:hidden z-50 safe-area-bottom">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => {
            const isActive = item.to === "/admin"
              ? location.pathname.startsWith("/admin")
              : location.pathname === item.to;
            const isAdminItem = item.isAdmin;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[56px]",
                  isActive
                    ? isAdminItem ? "text-amber-500" : "text-primary"
                    : isAdminItem ? "text-amber-500/70 hover:text-amber-500" : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                <div className={cn(
                  "relative p-1.5 rounded-xl transition-all duration-200",
                  isActive && (isAdminItem ? "bg-amber-500/10" : "bg-primary/10")
                )}>
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110"
                  )} />
                  {item.to === "/friends" && hasPendingRequests && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium mt-0.5 transition-all duration-200",
                  isActive
                    ? isAdminItem ? "text-amber-500" : "text-primary"
                    : isAdminItem ? "text-amber-500/70" : "text-muted-foreground"
                )}>
                  {t(item.labelKey)}
                </span>
                {isActive && (
                  <span className={cn(
                    "absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                    isAdminItem ? "bg-amber-500" : "bg-primary"
                  )} />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card/50 backdrop-blur-xl border-r border-border/50 hidden md:flex flex-col shadow-xl shadow-black/5 dark:shadow-black/20">
        <div className="p-6 border-b border-border/50">
          <div
            className="flex items-center justify-center cursor-pointer group"
            onClick={() => navigate("/")}
          >
            <img
              src={logoSrc}
              alt="Reppy Logo"
              className="max-h-20 rounded-lg object-contain transition-all duration-300 group-hover:scale-105 group-hover:opacity-90"
            />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item, index) => {
            const isActive = item.to === "/admin"
              ? location.pathname.startsWith("/admin")
              : location.pathname === item.to;
            const isAdminItem = item.isAdmin;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{ animationDelay: `${index * 50}ms` }}
                className={cn(
                  "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? isAdminItem
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25"
                      : "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : isAdminItem
                      ? "text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/10 active:scale-[0.98]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-[0.98]"
                )}
              >
                <div className="relative">
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    !isActive && "group-hover:scale-110"
                  )} />
                  {item.to === "/friends" && hasPendingRequests && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </div>
                <span className="font-medium">{t(item.labelKey)}</span>
                {isActive && (
                  <span className={cn(
                    "absolute right-3 w-1.5 h-1.5 rounded-full",
                    isAdminItem ? "bg-white/80" : "bg-primary-foreground/80"
                  )} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Hide logout button for guests */}
        {!isGuest && (
          <div className="p-4 border-t border-border/50">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 active:scale-[0.98] group"
                >
                  <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                  <span className="font-medium">{t("nav.logout")}</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.logoutConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("settings.logoutConfirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => signOut()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("nav.logout")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </aside>
    </div>
  );
}
