import { useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, parseISO, isToday, eachDayOfInterval, isSameDay, addMonths } from "date-fns";
import { ru, enUS, es, ptBR, de, fr, Locale } from "date-fns/locale";
import { Plus, Calendar as CalendarIcon, Trash2, Filter, X, Dumbbell, MessageSquare, List, ChevronLeft, ChevronRight, Activity, Timer, User } from "lucide-react";
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
  const { user } = useAuth();
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
  const [open, setOpen] = useState(false);
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

  const handleCreateWorkout = async () => {
    if (!date) return;

    try {
      const workout = await createWorkout.mutateAsync(
        format(date, "yyyy-MM-dd")
      );
      toast.success(t("workouts.workoutCreated"));
      setOpen(false);
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

  const isWeekend = (dateStr: string) => {
    const day = parseISO(dateStr).getDay();
    return day === 0 || day === 6;
  };

  // Calendar helpers
  const getWorkoutForDate = (date: Date) => {
    return workouts?.find((w) => isSameDay(new Date(w.date), date));
  };

  const getIntensity = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    const sets = workout?.workout_sets?.length || 0;
    if (sets === 0) return 0;
    if (sets <= 5) return 1;
    if (sets <= 10) return 2;
    if (sets <= 15) return 3;
    return 4;
  };

  const calendarMonthStart = startOfMonth(calendarMonth);
  const calendarMonthEnd = endOfMonth(calendarMonth);
  const calendarDays = eachDayOfInterval({ start: calendarMonthStart, end: calendarMonthEnd });
  const calendarStartDayOfWeek = calendarMonthStart.getDay();
  const adjustedStartDay = calendarStartDayOfWeek === 0 ? 6 : calendarStartDayOfWeek - 1;
  const weekDays = [
    t("workouts.weekDays.mon"),
    t("workouts.weekDays.tue"),
    t("workouts.weekDays.wed"),
    t("workouts.weekDays.thu"),
    t("workouts.weekDays.fri"),
    t("workouts.weekDays.sat"),
    t("workouts.weekDays.sun")
  ];

  const selectedWorkout = selectedCalendarDate ? getWorkoutForDate(selectedCalendarDate) : null;

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
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{t("workouts.title")}</h1>
          <div className="flex items-center gap-2">
            {/* View toggle */}
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
            {!isViewingOther && (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button className="gap-2 shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold transition-all hover:shadow-xl hover:scale-105 active:scale-95">
                    <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">{t("workouts.new")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    locale={dateLocale}
                    className="rounded-md border-0"
                  />
                  <div className="p-3 border-t border-border">
                    <Button
                      className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 font-semibold"
                      onClick={handleCreateWorkout}
                      disabled={createWorkout.isPending}
                    >
                      {t("workouts.createFor")} {date && format(date, "d MMM", { locale: dateLocale })}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>

      {isViewingOther && viewingUserProfile && (
        <ViewingUserBanner
          avatar={viewingUserProfile.avatar}
          displayName={viewingUserProfile.display_name}
          onClose={handleBackToMyWorkouts}
        />
      )}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Date Filter + User Selector */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
                  <span className="text-xs text-muted-foreground">
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
            </div>

            {/* User selector - for admins (all users) or regular users (friends only) */}
            {currentUserProfile?.is_admin ? (
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
                        <span className="truncate">{profile.display_name || t("common.anonymous")}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : friends && friends.length > 0 && (
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
                        <span className="truncate">{friendship.friend.display_name || t("common.anonymous")}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

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
                {/* Photo thumbnail or placeholder */}
                <div className="flex-shrink-0">
                  {workout.photo_url ? (
                    <img
                      src={workout.photo_url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <Dumbbell className="h-7 w-7 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {format(new Date(workout.date), "d MMMM", { locale: dateLocale })}
                    </span>
                    {isToday(parseISO(workout.date)) && (
                      <span className="hidden md:inline text-xs px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-600 dark:text-green-400">
                        {t("workouts.today")}
                      </span>
                    )}
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded font-medium",
                      isWeekend(workout.date)
                        ? "bg-primary/10 text-primary"
                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    )}>
                      {format(new Date(workout.date), "EEEE", { locale: dateLocale })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getUniqueExercises(workout)} {t("workouts.exercises")} · {getTotalSets(workout)} {t("workouts.sets")}
                  </p>
                  {workout.notes && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3 flex-shrink-0" />
                      <p className="line-clamp-1">{workout.notes}</p>
                    </div>
                  )}
                </div>

                {!isViewingOther && !workout.is_locked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500 flex-shrink-0"
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
                  const workout = getWorkoutForDate(day);
                  const intensity = getIntensity(workout);
                  const isTodayDate = isToday(day);
                  const isSelected = selectedCalendarDate && isSameDay(day, selectedCalendarDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        if (workout) {
                          setSelectedCalendarDate(day);
                        }
                      }}
                      className={cn(
                        "aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-all duration-200",
                        isTodayDate && "ring-1 ring-primary ring-offset-1 ring-offset-background",
                        isSelected && "bg-primary/20",
                        workout && "cursor-pointer hover:bg-muted",
                        !workout && "cursor-default"
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
                      {workout && (
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
            {selectedWorkout ? (
              <Card className="animate-scale-in">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{format(new Date(selectedWorkout.date), "d MMMM", { locale: dateLocale })}</span>
                    <Button size="sm" onClick={() => navigate(`/workout/${selectedWorkout.id}`)}>
                      {t("common.open")}
                    </Button>
                  </div>
                  {selectedWorkout.workout_sets && selectedWorkout.workout_sets.length > 0 ? (
                    <div className="space-y-2">
                      {Object.values(
                        selectedWorkout.workout_sets.reduce((acc, set) => {
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
                      {selectedWorkout.notes && (
                        <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg mt-2">
                          <MessageSquare className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground line-clamp-2">{selectedWorkout.notes}</p>
                        </div>
                      )}

                      {/* Photo */}
                      {selectedWorkout.photo_url && (
                        <div className="mt-3">
                          <img
                            src={selectedWorkout.photo_url}
                            alt=""
                            className="w-full h-32 lg:h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => navigate(`/workout/${selectedWorkout.id}`)}
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
    </div>
  );
}
