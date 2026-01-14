import { useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO, isToday, eachDayOfInterval, isSameDay, addMonths } from "date-fns";
import { ru, enUS, es, ptBR, de, fr, Locale } from "date-fns/locale";
import { Plus, Calendar as CalendarIcon, CalendarPlus, Trash2, Filter, X, Dumbbell, MessageSquare, List, ChevronLeft, ChevronRight, Activity, Timer, User, Layers, Route } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getExerciseName } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserWorkouts } from "@/hooks/useWorkouts";
import { useOfflineWorkouts, useOfflineCreateWorkout, useOfflineDeleteWorkout } from "@/offline";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useUserProfile } from "@/hooks/useProfile";
import { useOfflineProfile } from "@/offline/hooks/useOfflineProfile";
import { useAllProfiles } from "@/hooks/useAllProfiles";
import { useFriends } from "@/hooks/useFriends";
import { ViewingUserBanner } from "@/components/ViewingUserBanner";

const DATE_LOCALES: Record<string, Locale> = {
  en: enUS,
  es: es,
  "pt-BR": ptBR,
  de: de,
  fr: fr,
  ru: ru,
};

export default function Workouts() {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALES[i18n.language] || enUS;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isGuest } = useAuth();
  const { isOnline } = useOffline();

  const viewingUserId = searchParams.get("user");
  const isViewingOther = viewingUserId && viewingUserId !== user?.id;
  const targetUserId = viewingUserId || user?.id;

  const { data: currentUserProfile } = useOfflineProfile();
  const { data: viewingUserProfile } = useUserProfile(isViewingOther ? viewingUserId : null);
  const { data: allProfiles } = useAllProfiles();
  const { data: friends } = useFriends();

  // Use offline hooks for own workouts, online-only for others
  const { data: ownWorkouts, isLoading: ownLoading } = useOfflineWorkouts();
  const { data: otherWorkouts, isLoading: otherLoading } = useUserWorkouts(isViewingOther ? viewingUserId : null);

  const workouts = isViewingOther ? otherWorkouts : ownWorkouts;
  const isLoading = isViewingOther ? otherLoading : ownLoading;

  const createWorkout = useOfflineCreateWorkout();
  const deleteWorkout = useOfflineDeleteWorkout();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleUserChange = (userId: string) => {
    if (userId === user?.id) {
      searchParams.delete("user");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ user: userId });
    }
    setDateRange(undefined);
  };

  const handleBackToMyWorkouts = () => {
    searchParams.delete("user");
    setSearchParams(searchParams);
  };

  const handleCreateWorkoutToday = async () => {
    try {
      const workout = await createWorkout.mutateAsync(
        format(new Date(), "yyyy-MM-dd")
      );
      toast.success(t("workouts.workoutCreated"));
      navigate(`/workout/${workout.id}`);
    } catch (error) {
      toast.error(t("workouts.createError"));
    }
  };

  const handleCreateWorkoutForDate = async () => {
    if (!date) return;

    try {
      const workout = await createWorkout.mutateAsync(
        format(date, "yyyy-MM-dd")
      );
      toast.success(t("workouts.workoutCreated"));
      setCalendarDialogOpen(false);
      navigate(`/workout/${workout.id}`);
    } catch (error) {
      toast.error(t("workouts.createError"));
    }
  };

  const handleDeleteWorkout = (workoutId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorkoutToDelete(workoutId);
  };

  const confirmDelete = async () => {
    if (!workoutToDelete) return;

    // Check if workout is locked
    const workout = workouts?.find(w => w.id === workoutToDelete);
    if (workout?.is_locked) {
      toast.error(t("workouts.cannotDeleteLocked"));
      setWorkoutToDelete(null);
      return;
    }

    try {
      await deleteWorkout.mutateAsync(workoutToDelete);
      toast.success(t("workouts.workoutDeleted"));
      setWorkoutToDelete(null);
    } catch (error) {
      toast.error(t("workouts.deleteError"));
    }
  };

  const getTotalSets = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    return workout?.workout_sets?.length || 0;
  };

  const getUniqueExercises = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    const exerciseIds = new Set(workout?.workout_sets?.map(s => s.exercise_id));
    return exerciseIds.size;
  };

  const getTotalDistance = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    const distance = workout?.workout_sets?.reduce((sum, set) => sum + (set.distance_km || 0), 0) || 0;
    return distance > 0 ? Math.round(distance * 10) / 10 : 0;
  };

  const isWeekend = (dateStr: string) => {
    const day = parseISO(dateStr).getDay();
    return day === 0 || day === 6;
  };

  const getIntensity = (dayWorkouts: (typeof workouts extends (infer T)[] | undefined ? T : never)[] | undefined) => {
    if (!dayWorkouts || dayWorkouts.length === 0) return 0;
    const sets = dayWorkouts.reduce((total, w) => total + (w?.workout_sets?.length || 0), 0);
    if (sets === 0) return 0;
    if (sets <= 5) return 1;
    if (sets <= 10) return 2;
    if (sets <= 15) return 3;
    return 4;
  };

  // Memoize calendar computations to avoid recalculating on every render
  const { calendarDays, adjustedStartDay } = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = monthStart.getDay();
    const adjusted = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    return { calendarDays: days, adjustedStartDay: adjusted };
  }, [calendarMonth]);

  const weekDays = useMemo(() => [
    t("workouts.weekDays.mon"),
    t("workouts.weekDays.tue"),
    t("workouts.weekDays.wed"),
    t("workouts.weekDays.thu"),
    t("workouts.weekDays.fri"),
    t("workouts.weekDays.sat"),
    t("workouts.weekDays.sun")
  ], [t]);

  // Memoize workout lookup map for O(1) access instead of O(n) per day
  // Now stores arrays to support multiple workouts per day
  const workoutsByDate = useMemo(() => {
    if (!workouts) return new Map<string, typeof workouts>();
    const map = new Map<string, typeof workouts>();
    workouts.forEach((w) => {
      const existing = map.get(w.date) || [];
      map.set(w.date, [...existing, w]);
    });
    return map;
  }, [workouts]);

  const getWorkoutsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return workoutsByDate.get(dateStr);
  };

  const selectedWorkouts = selectedCalendarDate ? getWorkoutsForDate(selectedCalendarDate) : null;

  // Filter workouts by date range
  const filteredWorkouts = useMemo(() => {
    if (!workouts) return [];
    if (!dateRange?.from) return workouts;

    return workouts.filter((workout) => {
      const workoutDate = new Date(workout.date);

      if (dateRange.from && dateRange.to) {
        return isWithinInterval(workoutDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      } else if (dateRange.from) {
        return startOfDay(workoutDate).getTime() >= startOfDay(dateRange.from).getTime();
      }

      return true;
    });
  }, [workouts, dateRange]);

  const handleClearFilter = () => {
    setDateRange(undefined);
  };

  const handleQuickFilter = (days: number | "current-month" | "last-month") => {
    const today = new Date();

    if (days === "current-month") {
      setDateRange({
        from: startOfMonth(today),
        to: endOfMonth(today),
      });
    } else if (days === "last-month") {
      const lastMonth = subMonths(today, 1);
      setDateRange({
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      });
    } else {
      setDateRange({
        from: subDays(today, days - 1),
        to: today,
      });
    }
    setFilterOpen(false);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header row: title + user indicator/selector */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{t("workouts.title")}</h1>

        {/* User indicator/selector */}
        {isGuest ? (
          /* Guest mode - show guest label */
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-sm">👤</span>
            <span className="text-sm text-muted-foreground">{t("guest.mode")}</span>
          </div>
        ) : currentUserProfile?.is_admin ? (
          /* Admin - show all users selector */
          <Select value={targetUserId || ""} onValueChange={handleUserChange}>
            <SelectTrigger className="w-auto min-w-[140px] max-w-[180px] h-9 text-xs">
              <SelectValue placeholder={t("common.select")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={user?.id || ""}>
                <div className="flex items-center gap-2">
                  <span>{currentUserProfile?.avatar || "👤"}</span>
                  <span className="truncate">{currentUserProfile?.display_name || t("common.you")}</span>
                </div>
              </SelectItem>
              <SelectSeparator />
              {allProfiles?.filter(p => p.user_id !== user?.id).map((profile) => (
                <SelectItem key={profile.user_id} value={profile.user_id}>
                  <div className="flex items-center gap-2">
                    <span>{profile.avatar || "👤"}</span>
                    <div className="flex flex-col items-start">
                      <span className="truncate">{profile.display_name || t("common.anonymous")}</span>
                      {profile.username && (
                        <span className="text-xs text-muted-foreground">@{profile.username}</span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : friends && friends.length > 0 ? (
          /* User with friends - show friends selector */
          <Select value={targetUserId || ""} onValueChange={handleUserChange}>
            <SelectTrigger className="w-auto min-w-[140px] max-w-[180px] h-9 text-xs">
              <SelectValue placeholder={t("common.select")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={user?.id || ""}>
                <div className="flex items-center gap-2">
                  <span>{currentUserProfile?.avatar || "👤"}</span>
                  <span className="truncate">{currentUserProfile?.display_name || t("common.you")}</span>
                </div>
              </SelectItem>
              <SelectSeparator />
              {friends.map((friendship) => (
                <SelectItem key={friendship.friend.user_id} value={friendship.friend.user_id}>
                  <div className="flex items-center gap-2">
                    <span>{friendship.friend.avatar || "👤"}</span>
                    <div className="flex flex-col items-start">
                      <span className="truncate">{friendship.friend.display_name || t("common.anonymous")}</span>
                      {friendship.friend.username && (
                        <span className="text-xs text-muted-foreground">@{friendship.friend.username}</span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          /* User without friends - show user label */
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-sm">{currentUserProfile?.avatar || "👤"}</span>
            <span className="text-sm text-muted-foreground truncate max-w-[120px]">
              {currentUserProfile?.display_name || user?.email?.split("@")[0] || t("common.you")}
            </span>
          </div>
        )}
      </div>

      {isViewingOther && viewingUserProfile && (
        <ViewingUserBanner
          avatar={viewingUserProfile.avatar}
          displayName={viewingUserProfile.display_name}
          username={viewingUserProfile.username}
          onClose={handleBackToMyWorkouts}
        />
      )}

      {/* Date Filter (left) + View toggle (right) */}
      <div className="flex items-center justify-between gap-2">
        {/* Date filter - only in list view */}
        <div className="flex items-center gap-2">
          {viewMode === "list" && (
            <>
              <Popover open={filterOpen} onOpenChange={(open) => {
                setFilterOpen(open);
                if (!open) setDatePickerOpen(false);
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "d MMM", { locale: dateLocale })} – {format(dateRange.to, "d MMM", { locale: dateLocale })}
                        </>
                      ) : (
                        <>{format(dateRange.from, "d MMM", { locale: dateLocale })}</>
                      )
                    ) : (
                      t("workouts.filter.all")
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  {!datePickerOpen ? (
                    <div className="p-2 space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => {
                          setDateRange(undefined);
                          setFilterOpen(false);
                        }}
                      >
                        {t("workouts.filter.allWorkouts")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => handleQuickFilter(7)}
                      >
                        {t("workouts.filter.last7days")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => handleQuickFilter(30)}
                      >
                        {t("workouts.filter.last30days")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => handleQuickFilter("current-month")}
                      >
                        {t("workouts.filter.thisMonth")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => handleQuickFilter("last-month")}
                      >
                        {t("workouts.filter.lastMonth")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => setDatePickerOpen(true)}
                      >
                        {t("workouts.filter.byDate")}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="p-2 border-b border-border">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-xs h-8"
                          onClick={() => setDatePickerOpen(false)}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          {t("common.back")}
                        </Button>
                      </div>
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range);
                          if (range?.from && range?.to) {
                            setDatePickerOpen(false);
                            setFilterOpen(false);
                          }
                        }}
                        locale={dateLocale}
                        className="rounded-md border-0"
                        numberOfMonths={1}
                      />
                      <div className="p-2 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => {
                            setDateRange(undefined);
                            setDatePickerOpen(false);
                            setFilterOpen(false);
                          }}
                        >
                          {t("common.reset")}
                        </Button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {dateRange?.from && (
                <>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {filteredWorkouts.length} {t("workouts.workoutsCount")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={handleClearFilter}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </>
          )}
        </div>

        {/* View toggle - right aligned */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-md",
              viewMode === "list" && "bg-background shadow-sm"
            )}
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-md",
              viewMode === "calendar" && "bg-background shadow-sm"
            )}
            onClick={() => setViewMode("calendar")}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create workout button - full width */}
      {!isViewingOther && (
        <div className="flex shadow-lg rounded-md overflow-hidden">
          <Button
            onClick={handleCreateWorkoutToday}
            disabled={createWorkout.isPending}
            className="flex-1 gap-2 rounded-r-none bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold transition-all hover:shadow-xl active:scale-95"
          >
            <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
            <span>{t("workouts.new")}</span>
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={() => setCalendarDialogOpen(true)}
            className="rounded-l-none border-l border-primary-foreground/20 bg-primary/90 hover:bg-primary/80 text-primary-foreground px-3"
          >
            <CalendarPlus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkouts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {dateRange?.from ? t("workouts.noWorkoutsFiltered") : t("workouts.noWorkouts")}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {dateRange?.from
                ? t("workouts.tryDifferentDates")
                : t("workouts.createFirstWorkout")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((workout, index) => (
            <Card
              key={workout.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30",
                "animate-fade-in",
                isToday(parseISO(workout.date)) && "border-green-500/50 dark:border-green-400/50"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/workout/${workout.id}`)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                {/* Calendar date badge */}
                <div className={cn(
                  "flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center",
                  isToday(parseISO(workout.date))
                    ? "bg-green-500/15 text-green-600 dark:text-green-400"
                    : isWeekend(workout.date)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-foreground"
                )}>
                  <span className="text-xl font-bold leading-none">
                    {format(new Date(workout.date), "d")}
                  </span>
                  <span className="text-[10px] font-medium uppercase mt-0.5">
                    {format(new Date(workout.date), "MMM", { locale: dateLocale })}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium capitalize",
                      isToday(parseISO(workout.date))
                        ? "text-green-600 dark:text-green-400"
                        : isWeekend(workout.date)
                          ? "text-primary"
                          : "text-foreground"
                    )}>
                      {isToday(parseISO(workout.date))
                        ? t("workouts.today")
                        : format(new Date(workout.date), "EEEE", { locale: dateLocale })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Dumbbell className="h-3.5 w-3.5" />
                      {getUniqueExercises(workout)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {getTotalSets(workout)}
                    </span>
                    {getTotalDistance(workout) > 0 && (
                      <span className="flex items-center gap-1">
                        <Route className="h-3.5 w-3.5" />
                        {getTotalDistance(workout)} {t("units.km")}
                      </span>
                    )}
                  </div>
                  {workout.notes && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3 flex-shrink-0" />
                      <p className="line-clamp-1">{workout.notes}</p>
                    </div>
                  )}
                </div>

                {/* Photo thumbnail (if exists) */}
                {workout.photo_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={workout.photo_url}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  </div>
                )}

                {/* Delete button */}
                {!isViewingOther && !workout.is_locked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={(e) => handleDeleteWorkout(workout.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          </div>
        )}
        </>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Calendar */}
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold capitalize">
                  {format(calendarMonth, "LLLL yyyy", { locale: dateLocale })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Week days header */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {/* Empty cells for days before month start */}
                {Array.from({ length: adjustedStartDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {/* Days of the month */}
                {calendarDays.map((day) => {
                  const dayWorkouts = getWorkoutsForDate(day);
                  const hasWorkouts = dayWorkouts && dayWorkouts.length > 0;
                  const intensity = getIntensity(dayWorkouts);
                  const isTodayDate = isToday(day);
                  const isSelected = selectedCalendarDate && isSameDay(day, selectedCalendarDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        if (hasWorkouts) {
                          setSelectedCalendarDate(day);
                        }
                      }}
                      className={cn(
                        "aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-all duration-200",
                        isTodayDate && "ring-1 ring-primary ring-offset-1 ring-offset-background",
                        isSelected && "bg-primary/20",
                        hasWorkouts && "cursor-pointer hover:bg-muted",
                        !hasWorkouts && "cursor-default"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs sm:text-sm",
                          isTodayDate ? "font-bold text-primary" : "text-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {hasWorkouts && (
                        <div className="flex gap-0.5">
                          {dayWorkouts.length > 1 ? (
                            // Multiple workouts - show count indicator
                            <div className="flex items-center gap-0.5">
                              <div
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  intensity === 1 && "bg-primary/30",
                                  intensity === 2 && "bg-primary/50",
                                  intensity === 3 && "bg-primary/75",
                                  intensity >= 4 && "bg-primary"
                                )}
                              />
                              <span className="text-[8px] text-primary font-medium">×{dayWorkouts.length}</span>
                            </div>
                          ) : (
                            // Single workout - just show dot
                            <div
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                intensity === 1 && "bg-primary/30",
                                intensity === 2 && "bg-primary/50",
                                intensity === 3 && "bg-primary/75",
                                intensity >= 4 && "bg-primary"
                              )}
                            />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Intensity legend */}
              <div className="flex items-center justify-center gap-2 mt-3 text-[10px] sm:text-xs text-muted-foreground">
                <span>{t("common.less")}</span>
                <div className="flex gap-0.5">
                  <div className="w-2.5 h-2.5 rounded bg-primary/30" />
                  <div className="w-2.5 h-2.5 rounded bg-primary/50" />
                  <div className="w-2.5 h-2.5 rounded bg-primary/75" />
                  <div className="w-2.5 h-2.5 rounded bg-primary" />
                </div>
                <span>{t("common.more")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Selected workout details */}
          <div className="space-y-4">
            {selectedWorkouts && selectedWorkouts.length > 0 ? (
              selectedWorkouts.map((workout, workoutIndex) => (
                <Card key={workout.id} className="animate-scale-in">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">
                        {format(new Date(workout.date), "d MMMM", { locale: dateLocale })}
                        {selectedWorkouts.length > 1 && (
                          <span className="text-muted-foreground ml-1">#{workoutIndex + 1}</span>
                        )}
                      </span>
                      <Button size="sm" onClick={() => navigate(`/workout/${workout.id}`)}>
                        {t("common.open")}
                      </Button>
                    </div>
                    {workout.workout_sets && workout.workout_sets.length > 0 ? (
                      <div className="space-y-2">
                        {Object.values(
                          workout.workout_sets.reduce((acc, set) => {
                            const exerciseId = set.exercise_id;
                            if (!acc[exerciseId]) {
                              acc[exerciseId] = {
                                name: set.exercise?.name || t("exercises.exercise"),
                                type: set.exercise?.type || "weighted",
                                name_translations: set.exercise?.name_translations,
                                sets: 0,
                                totalReps: 0,
                                maxWeight: 0,
                                totalDistance: 0,
                                totalDuration: 0,
                                totalPlankSeconds: 0,
                              };
                            }
                            acc[exerciseId].sets++;
                            acc[exerciseId].totalReps += set.reps || 0;
                            if (set.weight && set.weight > acc[exerciseId].maxWeight) {
                              acc[exerciseId].maxWeight = set.weight;
                            }
                            acc[exerciseId].totalDistance += set.distance_km || 0;
                            acc[exerciseId].totalDuration += set.duration_minutes || 0;
                            acc[exerciseId].totalPlankSeconds += set.plank_seconds || 0;
                            return acc;
                          }, {} as Record<string, {
                            name: string;
                            type: string;
                            name_translations?: any;
                            sets: number;
                            totalReps: number;
                            maxWeight: number;
                            totalDistance: number;
                            totalDuration: number;
                            totalPlankSeconds: number;
                          }>)
                        ).map((exercise, i) => (
                          <div key={i} className="p-2.5 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {exercise.type === "cardio" ? (
                                <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                              ) : exercise.type === "weighted" ? (
                                <Dumbbell className="h-4 w-4 text-primary flex-shrink-0" />
                              ) : exercise.type === "timed" ? (
                                <Timer className="h-4 w-4 text-primary flex-shrink-0" />
                              ) : (
                                <User className="h-4 w-4 text-primary flex-shrink-0" />
                              )}
                              <span className="font-medium text-sm truncate">{getExerciseName(exercise.name, exercise.name_translations)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 ml-6">
                              {exercise.type === "cardio" ? (
                                <>{exercise.sets} {t("workouts.sets")} · {exercise.totalDistance.toFixed(1)} {t("units.km")} · {exercise.totalDuration} {t("units.min")}</>
                              ) : exercise.type === "timed" ? (
                                <>{exercise.sets} {t("workouts.sets")} · {exercise.totalPlankSeconds} {t("units.sec")}</>
                              ) : exercise.type === "bodyweight" ? (
                                <>{exercise.sets} {t("workouts.sets")} · {exercise.totalReps} {t("units.reps")}</>
                              ) : (
                                <>{exercise.sets} {t("workouts.sets")} · {exercise.totalReps} {t("units.reps")}{exercise.maxWeight > 0 && ` · ${exercise.maxWeight} ${t("units.kg")}`}</>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Workout notes */}
                        {workout.notes && (
                          <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg mt-2">
                            <MessageSquare className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground line-clamp-2">{workout.notes}</p>
                          </div>
                        )}

                        {/* Photo */}
                        {workout.photo_url && (
                          <div className="mt-3">
                            <img
                              src={workout.photo_url}
                              alt=""
                              className="w-full h-32 lg:h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => navigate(`/workout/${workout.id}`)}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        {t("workouts.noEntries")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="hidden lg:block">
                <CardContent className="p-8 text-center">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {t("workouts.selectDayWithWorkout")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!workoutToDelete} onOpenChange={(open) => !open && setWorkoutToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workouts.deleteWorkout")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workouts.deleteWorkoutConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Calendar Dialog for creating workout on other date */}
      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="sm:max-w-[350px] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{t("workouts.otherDate")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("workouts.otherDate")}
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-2 flex flex-col items-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={dateLocale}
              className="rounded-md border-0"
            />
            <Button
              className="w-full mt-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 font-semibold"
              onClick={handleCreateWorkoutForDate}
              disabled={createWorkout.isPending}
            >
              {t("workouts.createFor")} {date && format(date, "d MMM", { locale: dateLocale })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
