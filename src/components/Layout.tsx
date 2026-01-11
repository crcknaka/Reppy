import { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { TrendingUp, ListPlus, LogOut, Activity, Settings, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: "/", icon: Activity, label: "Тренировки" },
  { to: "/progress", icon: TrendingUp, label: "Прогресс" },
  { to: "/friends", icon: Users, label: "Друзья" },
  { to: "/exercises", icon: ListPlus, label: "Упражнения" },
  { to: "/settings", icon: Settings, label: "Настройки" },
];

export default function Layout({ children }: LayoutProps) {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/logo-white.png" : "/logo-black.png";

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[56px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground active:scale-95"
                )}
              >
                <div className={cn(
                  "relative p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/10"
                )}>
                  <item.icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110"
                  )} />
                </div>
                <span className={cn(
                  "text-[10px] font-medium mt-0.5 transition-all duration-200",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
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
              alt="FitTrack Logo"
              className="max-h-20 rounded-lg object-contain transition-all duration-300 group-hover:scale-105 group-hover:opacity-90"
            />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{ animationDelay: `${index * 50}ms` }}
                className={cn(
                  "relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-[0.98]"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  !isActive && "group-hover:scale-110"
                )} />
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary-foreground/80" />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 active:scale-[0.98] group"
          >
            <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
            <span className="font-medium">Выйти</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
