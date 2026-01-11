import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";
import { enUS, es, ptBR, de, fr, ru } from "date-fns/locale";
import { FileText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWorkoutsByMonth } from "@/hooks/useWorkouts";
import { useProfile } from "@/hooks/useProfile";
import { calculateMonthlyReportData } from "@/features/pdf-export";
import { toast } from "sonner";

const localeMap: Record<string, Locale> = {
  en: enUS,
  es: es,
  "pt-BR": ptBR,
  de: de,
  fr: fr,
  ru: ru,
};

export function PdfExportButton() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Month/year selection state
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  // Fetch data for selected month
  const { data: workouts, isLoading: workoutsLoading } = useWorkoutsByMonth(
    selectedYear,
    selectedMonth
  );
  const { data: profile } = useProfile();

  const dateLocale = localeMap[i18n.language] || enUS;

  // Navigate months
  const goToPreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleExport = async () => {
    if (!workouts) return;

    setIsGenerating(true);
    try {
      // Dynamically import PDF libraries for code splitting
      const [{ pdf }, { MonthlyReportPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/pdf-export/MonthlyReportPdf"),
      ]);

      // Calculate report data
      const reportData = calculateMonthlyReportData(workouts, i18n.language);

      // Format month/year for display
      const monthYear = format(
        new Date(selectedYear, selectedMonth, 1),
        "LLLL yyyy",
        { locale: dateLocale }
      );

      // Date formatter for daily breakdown
      const formatDateForPdf = (dateStr: string): string => {
        const date = parseISO(dateStr);
        return format(date, "d MMMM, EEEE", { locale: dateLocale });
      };

      // Prepare translations
      const translations = {
        title: t("pdfReport.title"),
        exerciseBreakdown: t("pdfReport.exerciseBreakdown"),
        workoutProgress: t("pdfReport.workoutProgress"),
        dailyBreakdown: t("pdfReport.dailyBreakdown"),
        noData: t("pdfReport.noData"),
        footer: t("pdfReport.footer"),
        stats: {
          workouts: t("pdfReport.stats.workouts"),
          totalReps: t("pdfReport.stats.totalReps"),
          totalSets: t("pdfReport.stats.totalSets"),
          maxWeight: t("pdfReport.stats.maxWeight"),
          volume: t("pdfReport.stats.volume"),
          distance: t("pdfReport.stats.distance"),
          duration: t("pdfReport.stats.duration"),
          plankTime: t("pdfReport.stats.plankTime"),
        },
        table: {
          exercise: t("pdfReport.table.exercise"),
          sets: t("pdfReport.table.sets"),
          reps: t("pdfReport.table.reps"),
          maxWeight: t("pdfReport.table.maxWeight"),
          volume: t("pdfReport.table.volume"),
        },
        daily: {
          sets: t("pdfReport.daily.sets"),
          reps: t("pdfReport.daily.reps"),
          weight: t("pdfReport.daily.weight"),
          distance: t("pdfReport.daily.distance"),
          time: t("pdfReport.daily.time"),
        },
        units: {
          kg: t("units.kg"),
          km: t("units.km"),
          h: t("units.h"),
          min: t("units.min"),
          sec: t("units.sec"),
        },
      };

      // Generate PDF
      const blob = await pdf(
        <MonthlyReportPdf
          userName={profile?.name || t("common.user")}
          monthYear={monthYear}
          data={reportData}
          translations={translations}
          formatDate={formatDateForPdf}
        />
      ).toBlob();

      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fittrack-${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t("pdfReport.generated"));
      setIsOpen(false);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error(t("pdfReport.error"));
    } finally {
      setIsGenerating(false);
    }
  };

  const formattedMonth = format(
    new Date(selectedYear, selectedMonth, 1),
    "LLLL yyyy",
    { locale: dateLocale }
  );

  const workoutCount = workouts?.length || 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">{t("pdfReport.exportPdf")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="text-sm font-medium">{t("pdfReport.selectMonth")}</div>

          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium capitalize">
              {formattedMonth}
            </span>
            <Button variant="ghost" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Workout count */}
          <div className="text-center text-sm text-muted-foreground">
            {workoutsLoading ? (
              <span>{t("common.loading")}</span>
            ) : (
              <span>
                {workoutCount} {t("pdfReport.stats.workouts").toLowerCase()}
              </span>
            )}
          </div>

          {/* Export button */}
          <Button
            onClick={handleExport}
            disabled={isGenerating || workoutsLoading}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("pdfReport.generating")}
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {t("pdfReport.download")}
              </>
            )}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
