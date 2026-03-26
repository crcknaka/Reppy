import { format, isSameDay, isToday } from "date-fns";
import type { Locale } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Workout } from "@/hooks/useWorkouts";
import { cn } from "@/lib/utils";

interface WorkoutCalendarPanelProps {
  calendarMonth: Date;
  dateLocale: Locale;
  weekDays: string[];
  calendarDays: Date[];
  adjustedStartDay: number;
  selectedCalendarDate: Date | null;
  getWorkoutsForDate: (date: Date) => Workout[] | undefined;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (date: Date) => void;
  labels: {
    less: string;
    more: string;
  };
}

const getIntensity = (dayWorkouts: Workout[] | undefined) => {
  if (!dayWorkouts || dayWorkouts.length === 0) return 0;
  const sets = dayWorkouts.reduce((total, workout) => total + (workout.workout_sets?.length || 0), 0);
  if (sets === 0) return 0;
  if (sets <= 5) return 1;
  if (sets <= 10) return 2;
  if (sets <= 15) return 3;
  return 4;
};

const intensityBgClass = (intensity: number) =>
  cn(
    intensity === 1 && "bg-primary/15",
    intensity === 2 && "bg-primary/30",
    intensity === 3 && "bg-primary/50",
    intensity >= 4 && "bg-primary/70"
  );

export function WorkoutCalendarPanel({
  calendarMonth,
  dateLocale,
  weekDays,
  calendarDays,
  adjustedStartDay,
  selectedCalendarDate,
  getWorkoutsForDate,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
  labels,
}: WorkoutCalendarPanelProps) {
  return (
    <Card className="lg:sticky lg:top-4 lg:self-start">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold capitalize">
            {format(calendarMonth, "LLLL yyyy", { locale: dateLocale })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: adjustedStartDay }).map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}

          {calendarDays.map((day) => {
            const dayWorkouts = getWorkoutsForDate(day);
            const workoutsCount = dayWorkouts?.length || 0;
            const hasWorkouts = workoutsCount > 0;
            const intensity = getIntensity(dayWorkouts);
            const isTodayDate = isToday(day);
            const isSelected = selectedCalendarDate ? isSameDay(day, selectedCalendarDate) : false;

            return (
              <button
                key={day.toISOString()}
                onClick={() => hasWorkouts && onSelectDate(day)}
                className={cn(
                  "aspect-square rounded-md flex items-center justify-center transition-all duration-200",
                  hasWorkouts && intensityBgClass(intensity),
                  isTodayDate && "ring-1.5 ring-primary ring-offset-1 ring-offset-background",
                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  hasWorkouts && "cursor-pointer hover:brightness-110",
                  !hasWorkouts && "cursor-default"
                )}
              >
                <span className={cn(
                  "text-xs sm:text-sm",
                  isTodayDate && "font-bold text-primary",
                  hasWorkouts && intensity >= 3 && "text-primary-foreground font-semibold",
                  hasWorkouts && intensity < 3 && "text-foreground font-medium",
                  !hasWorkouts && "text-muted-foreground"
                )}>
                  {format(day, "d")}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] sm:text-xs text-muted-foreground">
          <span>{labels.less}</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-primary/15" />
            <div className="w-3 h-3 rounded-sm bg-primary/30" />
            <div className="w-3 h-3 rounded-sm bg-primary/50" />
            <div className="w-3 h-3 rounded-sm bg-primary/70" />
          </div>
          <span>{labels.more}</span>
        </div>
      </CardContent>
    </Card>
  );
}

