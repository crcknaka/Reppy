import { useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, eachDayOfInterval } from "date-fns";
import { getDateLocale } from "@/lib/dateLocales";
import { Plus, Calendar as CalendarIcon, CalendarPlus, Filter, X, List, ChevronLeft } from "lucide-react";
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
import { useUnits } from "@/hooks/useUnits";
import { LIMITS } from "@/lib/limits";

const WORKOUTS_PER_PAGE = 10;
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
import { WorkoutListItemCard } from "@/components/workouts/WorkoutListItemCard";
import { WorkoutCalendarDetailCard } from "@/components/workouts/WorkoutCalendarDetailCard";
import { WorkoutCalendarPanel } from "@/components/workouts/WorkoutCalendarPanel";
import { ListSkeleton } from "@/components/ui/page-skeleton";
import { motion, AnimatePresence, staggerContainer, staggerItem, defaultTransition, useMotionEnabled } from "@/components/ui/motion";

export default function Workouts() {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isGuest } = useAuth();
  const { isOnline } = useOffline();
  const { convertDistance, units } = useUnits();
  const motionEnabled = useMotionEnabled();

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
  const [visibleCount, setVisibleCount] = useState(WORKOUTS_PER_PAGE);

  const handleUserChange = (userId: string) => {
    if (userId === user?.id) {
      searchParams.delete("user");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ user: userId });
    }
    setDateRange(undefined);
    setVisibleCount(WORKOUTS_PER_PAGE);
  };

  const handleBackToMyWorkouts = () => {
    searchParams.delete("user");
    setSearchParams(searchParams);
  };

  const getWorkoutsCountForDate = (targetDate: Date) => {
    const dateStr = format(targetDate, "yyyy-MM-dd");
    return workouts?.filter(w => w.date === dateStr).length || 0;
  };

  const handleCreateWorkoutToday = async () => {
    const today = new Date();
    const workoutsToday = getWorkoutsCountForDate(today);

    if (workoutsToday >= LIMITS.MAX_WORKOUTS_PER_DAY) {
      toast.error(t("limits.maxWorkoutsPerDay", { max: LIMITS.MAX_WORKOUTS_PER_DAY }));
      return;
    }

    try {
      const workout = await createWorkout.mutateAsync(
        format(today, "yyyy-MM-dd")
      );
      toast.success(t("workouts.workoutCreated"));
      navigate(`/workout/${workout.id}`);
    } catch (error) {
      toast.error(t("workouts.createError"));
    }
  };

  const handleCreateWorkoutForDate = async () => {
    if (!date) return;

    const workoutsOnDate = getWorkoutsCountForDate(date);

    if (workoutsOnDate >= LIMITS.MAX_WORKOUTS_PER_DAY) {
      toast.error(t("limits.maxWorkoutsPerDay", { max: LIMITS.MAX_WORKOUTS_PER_DAY }));
      return;
    }

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

  // Count personal records per workout
  const recordCountByWorkout = useMemo(() => {
    if (!workouts) return new Map<string, number>();

    // Sort workouts by date ascending to track running bests
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));

    const bests: Record<string, { maxWeight: number; maxReps: number; maxDistance: number; maxSeconds: number }> = {};
    const counts = new Map<string, number>();

    for (const w of sorted) {
      let records = 0;
      const exerciseGroups: Record<string, typeof w.workout_sets> = {};

      for (const s of w.workout_sets ?? []) {
        if (!exerciseGroups[s.exercise_id]) exerciseGroups[s.exercise_id] = [];
        exerciseGroups[s.exercise_id].push(s);
      }

      for (const [exId, sets] of Object.entries(exerciseGroups)) {
        const prev = bests[exId] ?? { maxWeight: 0, maxReps: 0, maxDistance: 0, maxSeconds: 0 };
        const type = sets[0]?.exercise?.type;

        if (type === "weighted") {
          const maxW = Math.max(...sets.map(s => s.weight || 0));
          if (maxW > prev.maxWeight && maxW > 0) records++;
          bests[exId] = { ...prev, maxWeight: Math.max(prev.maxWeight, maxW) };
        } else if (type === "bodyweight") {
          const maxR = Math.max(...sets.map(s => s.reps || 0));
          if (maxR > prev.maxReps && maxR > 0) records++;
          bests[exId] = { ...prev, maxReps: Math.max(prev.maxReps, maxR) };
        } else if (type === "cardio") {
          const maxD = Math.max(...sets.map(s => s.distance_km || 0));
          if (maxD > prev.maxDistance && maxD > 0) records++;
          bests[exId] = { ...prev, maxDistance: Math.max(prev.maxDistance, maxD) };
        } else if (type === "timed") {
          const maxS = Math.max(...sets.map(s => s.plank_seconds || 0));
          if (maxS > prev.maxSeconds && maxS > 0) records++;
          bests[exId] = { ...prev, maxSeconds: Math.max(prev.maxSeconds, maxS) };
        }
      }

      if (records > 0) counts.set(w.id, records);
    }

    return counts;
  }, [workouts]);

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

  // Apply pagination only when no filter is active
  const visibleWorkouts = useMemo(() => {
    if (dateRange?.from) {
      // When filter is active, show all filtered results
      return filteredWorkouts;
    }
    // When no filter, apply pagination
    return filteredWorkouts.slice(0, visibleCount);
  }, [filteredWorkouts, visibleCount, dateRange]);

  const hasMore = !dateRange?.from && filteredWorkouts.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + WORKOUTS_PER_PAGE);
  };

  const handleClearFilter = () => {
    setDateRange(undefined);
    setVisibleCount(WORKOUTS_PER_PAGE); // Reset pagination when clearing filter
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
    <div className="space-y-4">
      {/* Header row: title + user indicator/selector */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{t("workouts.title")}</h1>

        {/* User indicator/selector */}
        {isGuest ? (
          /* Guest mode - show guest label, clickable to go to Friends page for login */
          <button
            onClick={() => navigate("/friends")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/70 hover:border-primary/50 transition-colors cursor-pointer"
          >
            <span className="text-sm">👤</span>
            <span className="text-sm text-muted-foreground">{t("guest.mode")}</span>
          </button>
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
        <ListSkeleton />
      ) : visibleWorkouts.length === 0 ? (
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
        <motion.div className="space-y-3" {...(motionEnabled ? { variants: staggerContainer, initial: "hidden", animate: "visible" } : {})}>
          <AnimatePresence>
          {visibleWorkouts.map((workout, index) => (
            <motion.div
              key={workout.id}
              layout={motionEnabled}
              {...(motionEnabled ? {
                variants: staggerItem,
                transition: defaultTransition,
                exit: { opacity: 0, x: -30, scale: 0.95, transition: { duration: 0.25 } },
              } : {})}
            >
              <WorkoutListItemCard
                workout={workout}
                index={index}
                dateLocale={dateLocale}
                isViewingOther={!!isViewingOther}
                convertDistance={convertDistance}
                distanceUnit={units.distance}
                todayLabel={t("workouts.today")}
                onOpen={(workoutId) => navigate(`/workout/${workoutId}`)}
                onDelete={handleDeleteWorkout}
                recordCount={recordCountByWorkout.get(workout.id)}
              />
            </motion.div>
          ))}
          </AnimatePresence>

          {/* Load More Button */}
          {hasMore && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLoadMore}
            >
              {t("workouts.loadMore")} ({filteredWorkouts.length - visibleCount} {t("workouts.remaining")})
            </Button>
          )}
          </motion.div>
        )}
        </>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <WorkoutCalendarPanel
            calendarMonth={calendarMonth}
            dateLocale={dateLocale}
            weekDays={weekDays}
            calendarDays={calendarDays}
            adjustedStartDay={adjustedStartDay}
            selectedCalendarDate={selectedCalendarDate}
            getWorkoutsForDate={getWorkoutsForDate}
            onPrevMonth={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            onNextMonth={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            onSelectDate={setSelectedCalendarDate}
            labels={{
              less: t("common.less"),
              more: t("common.more"),
            }}
          />

          {/* Selected workout details */}
          <div className="space-y-4">
            {selectedWorkouts && selectedWorkouts.length > 0 ? (
              selectedWorkouts.map((workout, workoutIndex) => (
                <WorkoutCalendarDetailCard
                  key={workout.id}
                  workout={workout}
                  workoutIndex={workoutIndex}
                  selectedWorkoutsCount={selectedWorkouts.length}
                  dateLocale={dateLocale}
                  convertDistance={convertDistance}
                  distanceUnit={units.distance}
                  onOpen={(workoutId) => navigate(`/workout/${workoutId}`)}
                  labels={{
                    open: t("common.open"),
                    sets: t("workouts.sets"),
                    min: t("units.min"),
                    sec: t("units.sec"),
                    reps: t("units.reps"),
                    kg: t("units.kg"),
                    noEntries: t("workouts.noEntries"),
                    exerciseFallback: t("exercises.exercise"),
                  }}
                />
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
