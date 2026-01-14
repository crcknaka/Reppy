import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { format, isToday, parseISO } from "date-fns";
import { ru, enUS, es, ptBR, de, fr, Locale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { getExerciseName } from "@/lib/i18n";
import { ArrowLeft, Plus, Trash2, User, Dumbbell, MessageSquare, Save, Pencil, X, Activity, Timer, Camera, Loader2, ImageIcon, LayoutGrid, Trophy, Search, Share2, Copy, Check, Ban, Lock, Unlock, Star, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUserAllTimeBests, useLockWorkout, useUnlockWorkout } from "@/hooks/useWorkouts";
import { Exercise } from "@/hooks/useExercises";
import { useWorkoutShare, useCreateWorkoutShare, useDeactivateWorkoutShare } from "@/hooks/useWorkoutShare";
import {
  useOfflineSingleWorkout,
  useOfflineAddSet,
  useOfflineDeleteSet,
  useOfflineUpdateSet,
  useOfflineUpdateWorkout,
  useOfflineExercises,
  useOfflineFavoriteExercises,
  useOfflineToggleFavoriteExercise,
  getLastSetForExercise,
} from "@/offline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useUserProfile } from "@/hooks/useProfile";
import { uploadWorkoutPhoto, deleteWorkoutPhoto, validateImageFile, compressImage } from "@/lib/photoUpload";
import { ViewingUserBanner } from "@/components/ViewingUserBanner";
import { ExerciseTimer } from "@/components/ExerciseTimer";
import { useUnits } from "@/hooks/useUnits";
import { useAutoFillLastSet } from "@/hooks/useAutoFillLastSet";

const DATE_LOCALES: Record<string, Locale> = {
  en: enUS,
  es: es,
  "pt-BR": ptBR,
  de: de,
  fr: fr,
  ru: ru,
};

export default function WorkoutDetail() {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALES[i18n.language] || enUS;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, effectiveUserId, isGuest } = useAuth();
  const { isOnline } = useOffline();
  // Use offline-first hooks for data
  const { data: workout, isLoading: isWorkoutLoading, isFetching, isError } = useOfflineSingleWorkout(id);
  const { data: exercises } = useOfflineExercises();
  const { data: favoriteExercises } = useOfflineFavoriteExercises();
  const toggleFavorite = useOfflineToggleFavoriteExercise();
  // Use offline hooks for set and workout operations
  const addSet = useOfflineAddSet();
  const deleteSet = useOfflineDeleteSet();
  const updateSet = useOfflineUpdateSet();
  const updateWorkout = useOfflineUpdateWorkout();
  const { data: allTimeBests } = useUserAllTimeBests(user?.id, id);

  // Check if current user is the owner (works for both authenticated users and guests)
  const isOwner = workout?.user_id === effectiveUserId;

  // Fetch workout owner's profile for banner (only when viewing others)
  const { data: workoutOwnerProfile } = useUserProfile(!isOwner && workout ? workout.user_id : null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState<"all" | "bodyweight" | "weighted" | "cardio" | "timed">("all");
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseTab, setExerciseTab] = useState<"all" | "favorites">("all");
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editDistance, setEditDistance] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(false);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Share hooks
  const { data: workoutShare } = useWorkoutShare(workout?.id);
  const createShare = useCreateWorkoutShare();
  const deactivateShare = useDeactivateWorkoutShare();

  // Lock hooks
  const lockWorkout = useLockWorkout();
  const unlockWorkout = useUnlockWorkout();
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);

  // Unit system for conversion
  const { units, convertWeight, convertDistance, toMetricWeight, toMetricDistance } = useUnits();
  const { autoFillEnabled } = useAutoFillLastSet();

  // Load workout notes when workout changes
  useEffect(() => {
    if (workout?.notes) {
      setNotes(workout.notes);
    } else {
      setNotes("");
    }
  }, [workout]);

  // Block scroll when photo is fullscreen
  useEffect(() => {
    if (isPhotoFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isPhotoFullscreen]);

  // Auto-open dialog with selected exercise if coming from Exercises page
  useEffect(() => {
    const state = location.state as { autoAddExerciseId?: string } | null;
    if (state?.autoAddExerciseId && exercises) {
      const exercise = exercises.find((e) => e.id === state.autoAddExerciseId);
      if (exercise) {
        setSelectedExercise(exercise);
        setDialogOpen(true);
        // Auto-fill last set data for all exercise types (if enabled)
        if (autoFillEnabled && effectiveUserId) {
          getLastSetForExercise(exercise.id, effectiveUserId).then((lastData) => {
            if (!lastData) return;
            switch (exercise.type) {
              case "weighted":
                if (lastData.weight) setWeight(convertWeight(lastData.weight).toString());
                if (lastData.reps) setReps(lastData.reps.toString());
                break;
              case "bodyweight":
                if (lastData.reps) setReps(lastData.reps.toString());
                break;
              case "cardio":
                if (lastData.distance_km) setDistance(convertDistance(lastData.distance_km).toString());
                if (lastData.duration_minutes) setDuration(lastData.duration_minutes.toString());
                break;
              case "timed":
                if (lastData.plank_seconds) setDuration(lastData.plank_seconds.toString());
                break;
            }
          });
        }
        // Clear the state to prevent reopening on re-render
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, exercises, navigate, location.pathname, effectiveUserId, convertWeight, convertDistance, autoFillEnabled]);

  // Group sets by exercise - must be before early returns to follow hooks rules
  const setsByExercise = useMemo(() => {
    if (!workout?.workout_sets) return {};
    return workout.workout_sets.reduce((acc, set) => {
      const exerciseId = set.exercise_id;
      if (!acc[exerciseId]) {
        acc[exerciseId] = {
          exercise: set.exercise,
          sets: [],
        };
      }
      acc[exerciseId].sets.push(set);
      return acc;
    }, {} as Record<string, { exercise: typeof workout.workout_sets[0]["exercise"]; sets: typeof workout.workout_sets }>);
  }, [workout?.workout_sets]);

  // Calculate which sets are all-time personal records (new records only, not equal)
  const recordSetIds = useMemo(() => {
    const result: Set<string> = new Set();

    Object.entries(setsByExercise).forEach(([exerciseId, { exercise, sets }]) => {
      if (!sets || sets.length === 0) return;

      const sortedSets = [...sets].sort((a, b) => a.set_number - b.set_number);
      const historicalBest = allTimeBests?.[exerciseId];

      switch (exercise?.type) {
        case "weighted": {
          // Show trophy only if current weight is STRICTLY GREATER than historical best
          const currentMaxWeight = Math.max(...sortedSets.map(s => s.weight || 0));
          // If no historical best (new exercise), first set with value is a record
          if (currentMaxWeight > 0 && currentMaxWeight > (historicalBest?.maxWeight || 0)) {
            // Mark the first set that achieves this weight
            const firstMaxSet = sortedSets.find(s => s.weight === currentMaxWeight);
            if (firstMaxSet) result.add(firstMaxSet.id);
          }
          break;
        }
        case "bodyweight": {
          const currentMaxReps = Math.max(...sortedSets.map(s => s.reps || 0));
          if (currentMaxReps > 0 && currentMaxReps > (historicalBest?.maxReps || 0)) {
            const firstMaxSet = sortedSets.find(s => s.reps === currentMaxReps);
            if (firstMaxSet) result.add(firstMaxSet.id);
          }
          break;
        }
        case "cardio": {
          const currentMaxDistance = Math.max(...sortedSets.map(s => s.distance_km || 0));
          if (currentMaxDistance > 0 && currentMaxDistance > (historicalBest?.maxDistance || 0)) {
            const firstMaxSet = sortedSets.find(s => s.distance_km === currentMaxDistance);
            if (firstMaxSet) result.add(firstMaxSet.id);
          }
          break;
        }
        case "timed": {
          const currentMaxSeconds = Math.max(...sortedSets.map(s => s.plank_seconds || 0));
          if (currentMaxSeconds > 0 && currentMaxSeconds > (historicalBest?.maxSeconds || 0)) {
            const firstMaxSet = sortedSets.find(s => s.plank_seconds === currentMaxSeconds);
            if (firstMaxSet) result.add(firstMaxSet.id);
          }
          break;
        }
      }
    });

    return result;
  }, [setsByExercise, allTimeBests]);

  // Filter exercises based on tab, type filter, and search query
  const filteredExercises = useMemo(() => {
    if (!exercises) return [];

    let filtered = exercises;

    // Filter by favorites tab
    if (exerciseTab === "favorites" && favoriteExercises) {
      filtered = filtered.filter(e => favoriteExercises.has(e.id));
    }

    // Filter by exercise type
    if (exerciseTypeFilter !== "all") {
      filtered = filtered.filter(e => e.type === exerciseTypeFilter);
    }

    // Filter by search query (uses translated name)
    if (exerciseSearchQuery) {
      filtered = filtered.filter(e => {
        const translatedName = getExerciseName(e.name, e.name_translations);
        return translatedName.toLowerCase().includes(exerciseSearchQuery.toLowerCase());
      });
    }

    return filtered;
  }, [exercises, exerciseTab, favoriteExercises, exerciseTypeFilter, exerciseSearchQuery]);

  // Show loader while loading or fetching (includes retries)
  if (isWorkoutLoading || (isFetching && !workout)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to workouts list if workout not found (deleted on another device)
  if (isError || (!workout && !isFetching)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">{t("workout.notFound")}</p>
        <Button variant="outline" onClick={() => navigate("/workouts")}>
          {t("workout.backToWorkouts")}
        </Button>
      </div>
    );
  }

  // Safety check - should not happen but prevents crashes
  if (!workout) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleToggleFavorite = async (exerciseId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent exercise selection when clicking star
    const isFavorite = favoriteExercises?.has(exerciseId) || false;

    try {
      await toggleFavorite.mutateAsync({ exerciseId, isFavorite });
      toast.success(isFavorite ? t("workout.removedFromFavorites") : t("workout.addedToFavorites"));
    } catch (error) {
      toast.error(t("workout.favoriteError"));
    }
  };

  // Handle exercise selection with auto-fill of last set data
  const handleSelectExercise = async (exercise: Exercise) => {
    setSelectedExercise(exercise);

    // Skip auto-fill if disabled or no effective user
    if (!autoFillEnabled || !effectiveUserId) return;

    try {
      const lastData = await getLastSetForExercise(exercise.id, effectiveUserId);
      if (!lastData) return;

      switch (exercise.type) {
        case "weighted":
          if (lastData.weight) {
            setWeight(convertWeight(lastData.weight).toString());
          }
          if (lastData.reps) {
            setReps(lastData.reps.toString());
          }
          break;

        case "bodyweight":
          if (lastData.reps) {
            setReps(lastData.reps.toString());
          }
          break;

        case "cardio":
          if (lastData.distance_km) {
            setDistance(convertDistance(lastData.distance_km).toString());
          }
          if (lastData.duration_minutes) {
            setDuration(lastData.duration_minutes.toString());
          }
          break;

        case "timed":
          if (lastData.plank_seconds) {
            setDuration(lastData.plank_seconds.toString());
          }
          break;
      }
    } catch (error) {
      // Silently fail - not critical for UX
      console.error("Failed to get last set data:", error);
    }
  };

  const handleAddSet = async () => {
    if (!selectedExercise) {
      toast.error(t("workout.enterExercise"));
      return;
    }

    // Cardio validation
    if (selectedExercise.type === "cardio") {
      if (!distance || !duration) {
        toast.error(t("workout.cardioRequired"));
        return;
      }
      const distanceNum = parseFloat(distance);
      const durationNum = parseInt(duration);
      if (isNaN(distanceNum) || distanceNum <= 0 || distanceNum > 500) {
        toast.error(t("workout.distanceRange"));
        return;
      }
      if (isNaN(durationNum) || durationNum <= 0 || durationNum > 1440) {
        toast.error(t("workout.durationRange"));
        return;
      }
    } else if (selectedExercise.type === "timed") {
      // Timed exercises validation
      if (!duration) {
        toast.error(t("workout.enterTime"));
        return;
      }
      const durationNum = parseInt(duration);
      if (isNaN(durationNum) || durationNum <= 0 || durationNum > 3600) {
        toast.error(t("workout.timeRange"));
        return;
      }
    } else if (selectedExercise.type === "weighted") {
      // Weighted exercises validation
      if (!reps || !weight) {
        toast.error(t("workout.weightedRequired"));
        return;
      }
    } else if (selectedExercise.type === "bodyweight") {
      // Bodyweight exercises validation
      if (!reps) {
        toast.error(t("workout.enterReps"));
        return;
      }
    }

    const existingSets = setsByExercise[selectedExercise.id]?.sets.length || 0;

    try {
      // Convert from user's unit system to metric for storage
      const weightInKg = weight ? toMetricWeight(parseFloat(weight)) : undefined;
      const distanceInKm = distance ? toMetricDistance(parseFloat(distance)) : undefined;

      await addSet.mutateAsync({
        workoutId: workout.id,
        exerciseId: selectedExercise.id,
        setNumber: existingSets + 1,
        reps: reps ? parseInt(reps) : undefined,
        weight: weightInKg,
        distance_km: distanceInKm,
        duration_minutes: selectedExercise.type === "cardio" && duration ? parseInt(duration) : undefined,
        plank_seconds: selectedExercise.type === "timed" && duration ? parseInt(duration) : undefined,
      });
      toast.success(t("workout.setAdded"));
      setReps("");
      setWeight("");
      setDistance("");
      setDuration("");
      setSelectedExercise(null);
      setDialogOpen(false);
    } catch (error) {
      toast.error(t("workout.setAddError"));
    }
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Сбросить форму при закрытии
      setSelectedExercise(null);
      setReps("");
      setWeight("");
      setDistance("");
      setDuration("");
      setShowTimer(false);
      setExerciseSearchQuery("");
    }
  };

  const handleDeleteSet = (setId: string) => {
    setSetToDelete(setId);
  };

  const confirmDeleteSet = async () => {
    if (!setToDelete) return;
    try {
      await deleteSet.mutateAsync(setToDelete);
      toast.success(t("workout.setDeleted"));
      setSetToDelete(null);
    } catch (error) {
      toast.error(t("workout.setDeleteError"));
    }
  };

  const handleEditSet = (set: any) => {
    setEditingSetId(set.id);
    setEditReps(set.reps?.toString() || "");
    // Convert from metric to user's unit system for display
    setEditWeight(set.weight ? convertWeight(set.weight).toString() : "");
    setEditDistance(set.distance_km ? convertDistance(set.distance_km).toString() : "");
    // Для cardio используем duration_minutes, для timed - plank_seconds
    const durationValue = set.exercise?.type === "timed"
      ? set.plank_seconds
      : set.duration_minutes;
    setEditDuration(durationValue ? durationValue.toString() : "");
  };

  const handleSaveEdit = async () => {
    if (!editingSetId) return;

    // Найти редактируемый set чтобы определить тип упражнения
    const currentSet = workout?.workout_sets?.find(s => s.id === editingSetId);
    const exerciseType = currentSet?.exercise?.type;

    // Convert from user's unit system to metric for storage
    const weightInKg = editWeight ? toMetricWeight(parseFloat(editWeight)) : null;
    const distanceInKm = editDistance ? toMetricDistance(parseFloat(editDistance)) : null;

    try {
      await updateSet.mutateAsync({
        setId: editingSetId,
        reps: editReps ? parseInt(editReps) : null,
        weight: weightInKg,
        distance_km: distanceInKm,
        duration_minutes: exerciseType === "cardio" && editDuration ? parseInt(editDuration) : null,
        plank_seconds: exerciseType === "timed" && editDuration ? parseInt(editDuration) : null,
      });
      toast.success(t("workout.setUpdated"));
      setEditingSetId(null);
      setEditReps("");
      setEditWeight("");
      setEditDistance("");
      setEditDuration("");
    } catch (error) {
      toast.error(t("workout.setUpdateError"));
    }
  };

  const handleCancelEdit = () => {
    setEditingSetId(null);
    setEditReps("");
    setEditWeight("");
  };

  const handleSaveNotes = async () => {
    if (!workout) return;

    try {
      await updateWorkout.mutateAsync({
        workoutId: workout.id,
        notes: notes.trim(),
      });
      setIsEditingNotes(false);
      toast.success(t("workout.commentSaved"));
    } catch (error) {
      toast.error(t("workout.commentSaveError"));
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !workout || !effectiveUserId) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(t(validation.errorKey || "common.error"));
      return;
    }

    setIsUploadingPhoto(true);
    try {
      let photoUrl: string;

      if (isGuest) {
        // For guests: compress and store as base64 data URL locally
        const compressedFile = await compressImage(file);
        const reader = new FileReader();
        photoUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        });
      } else {
        // For authenticated users: upload to Supabase Storage
        photoUrl = await uploadWorkoutPhoto(file, effectiveUserId, workout.id);
      }

      await updateWorkout.mutateAsync({
        workoutId: workout.id,
        photo_url: photoUrl,
      });
      toast.success(t("workout.photoAdded"));
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.error(t("workout.photoAddError"));
    } finally {
      setIsUploadingPhoto(false);
      // Reset input
      event.target.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (!workout?.photo_url) return;

    try {
      // Only delete from Supabase Storage if it's a URL (not base64 for guests)
      if (!isGuest && !workout.photo_url.startsWith("data:")) {
        await deleteWorkoutPhoto(workout.photo_url);
      }
      await updateWorkout.mutateAsync({
        workoutId: workout.id,
        photo_url: null,
      });
      setPhotoToDelete(false);
      toast.success(t("workout.photoDeleted"));
    } catch (error) {
      console.error("Photo delete error:", error);
      toast.error(t("workout.photoDeleteError"));
    }
  };

  const handleShareWorkout = async () => {
    if (!workout || !user) return;
    if (!isOnline) {
      toast.error(t("offline.featureRequiresInternet"));
      return;
    }

    try {
      const share = await createShare.mutateAsync({
        workoutId: workout.id,
        userId: user.id,
      });

      const shareUrl = `${window.location.origin}/share/${share.share_token}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("workout.linkCopied"));
    } catch (error) {
      console.error("Share error:", error);
      toast.error(t("workout.linkCreateError"));
    }
  };

  const handleDeactivateShare = async () => {
    if (!workoutShare) return;
    if (!isOnline) {
      toast.error(t("offline.featureRequiresInternet"));
      return;
    }

    try {
      await deactivateShare.mutateAsync(workoutShare.id);
      toast.success(t("workout.linkDeactivated"));
      setShareDialogOpen(false);
    } catch (error) {
      console.error("Deactivate error:", error);
      toast.error(t("workout.linkDeactivateError"));
    }
  };

  const copyShareLink = async () => {
    if (!workoutShare) return;

    const shareUrl = `${window.location.origin}/share/${workoutShare.share_token}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t("workout.linkCopied"));
  };

  const handleLockWorkout = async () => {
    if (!workout) return;

    try {
      await lockWorkout.mutateAsync(workout.id);
      toast.success(t("workouts.workoutLocked"));
    } catch (error) {
      console.error("Lock error:", error);
      toast.error(t("workouts.lockError"));
    }
  };

  const handleUnlockWorkout = async () => {
    if (!workout) return;

    try {
      await unlockWorkout.mutateAsync(workout.id);
      toast.success(t("workouts.workoutUnlocked"));
      setUnlockDialogOpen(false);
    } catch (error) {
      console.error("Unlock error:", error);
      toast.error(t("workouts.unlockError"));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            {format(new Date(workout.date), "d MMMM yyyy", { locale: dateLocale })}
          </h1>
          <div className="flex items-center gap-2">
            {isToday(parseISO(workout.date)) && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-green-500/15 text-green-600 dark:text-green-400">
                {t("workouts.today")}
              </span>
            )}
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded font-medium",
              [0, 6].includes(new Date(workout.date).getDay())
                ? "bg-primary/10 text-primary"
                : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
            )}>
              {format(new Date(workout.date), "EEEE", { locale: dateLocale })}
            </span>
          </div>
        </div>
        {isOwner && !isGuest && (
          <>
            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Share2 className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("workout.shareWorkout")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {workoutShare ? (
                    <>
                      <div className="space-y-2">
                        <Label>{t("workout.publicLink")}</Label>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={`${window.location.origin}/share/${workoutShare.share_token}`}
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={copyShareLink}
                          >
                            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t("workout.anyoneWithLink")}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        className="w-full gap-2"
                        onClick={handleDeactivateShare}
                        disabled={deactivateShare.isPending}
                      >
                        <Ban className="h-4 w-4" />
                        {t("workout.deactivateLink")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t("workout.createLinkDescription")}
                      </p>
                      <Button
                        className="w-full gap-2"
                        onClick={handleShareWorkout}
                        disabled={createShare.isPending}
                      >
                        <Share2 className="h-4 w-4" />
                        {t("workout.createLink")}
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

          </>
        )}

        {/* Lock/Unlock Button - available for owner (including guests) */}
        {isOwner && (
          <>
            {workout?.is_locked ? (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setUnlockDialogOpen(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Lock className="h-5 w-5" />
                </Button>

                <AlertDialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("workouts.unlockWorkoutTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("workouts.unlockWorkoutDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleUnlockWorkout}
                        disabled={unlockWorkout.isPending}
                      >
                        {t("common.unlock")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button
                variant="outline"
                size="icon"
                onClick={handleLockWorkout}
                disabled={lockWorkout.isPending}
              >
                <Unlock className="h-5 w-5" />
              </Button>
            )}
          </>
        )}
      </div>

      {!isOwner && workoutOwnerProfile && (
        <ViewingUserBanner
          avatar={workoutOwnerProfile.avatar}
          displayName={workoutOwnerProfile.display_name}
          onClose={() => navigate("/")}
        />
      )}

      {isOwner && !workout?.is_locked && (
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              {t("workout.addExercise")}
            </Button>
          </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="exercise-dialog-description">
          <DialogHeader>
            <DialogTitle>
              {selectedExercise ? getExerciseName(selectedExercise.name, selectedExercise.name_translations) : t("workout.selectExercise")}
            </DialogTitle>
            <p id="exercise-dialog-description" className="sr-only">
              {selectedExercise ? t("workout.addingSetFor") : t("workout.selectingExercise")}
            </p>
          </DialogHeader>
          
          {!selectedExercise ? (
            <>
              {/* Tabs: All / Favorites */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant={exerciseTab === "all" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setExerciseTab("all")}
                >
                  {t("common.all")}
                </Button>
                <Button
                  variant={exerciseTab === "favorites" ? "default" : "outline"}
                  className="flex-1 gap-2"
                  onClick={() => setExerciseTab("favorites")}
                >
                  <Star className="h-4 w-4" />
                  {t("workout.favorites")}
                </Button>
              </div>

              {/* Filter and Search */}
              <div className="mt-4 space-y-3">
                <Select value={exerciseTypeFilter} onValueChange={(v) => setExerciseTypeFilter(v as "all" | "bodyweight" | "weighted" | "cardio" | "timed")}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        {t("progress.allTypes")}
                      </div>
                    </SelectItem>
                    <SelectItem value="bodyweight">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t("progress.bodyweight")}
                      </div>
                    </SelectItem>
                    <SelectItem value="weighted">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        {t("progress.weighted")}
                      </div>
                    </SelectItem>
                    <SelectItem value="cardio">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {t("progress.cardio")}
                      </div>
                    </SelectItem>
                    <SelectItem value="timed">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        {t("progress.timed")}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("workout.exerciseSearch")}
                    value={exerciseSearchQuery}
                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                    className="pl-9 h-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
              {filteredExercises.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  {exerciseTab === "favorites" ? t("workout.noFavorites") : t("exercises.noExercisesFound")}
                </div>
              ) : (
                filteredExercises.map((exercise) => {
                  const isFavorite = favoriteExercises?.has(exercise.id) || false;
                  return (
                    <div
                      key={exercise.id}
                      onClick={() => handleSelectExercise(exercise)}
                      className="text-left group hover:scale-[1.02] transition-transform cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectExercise(exercise)}
                    >
                      <div className="border rounded-lg overflow-hidden hover:border-primary transition-colors relative">
                        {/* Favorite Star Button */}
                        <button
                          onClick={(e) => handleToggleFavorite(exercise.id, e)}
                          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
                        >
                          <Star
                            className={cn(
                              "h-4 w-4 transition-colors",
                              isFavorite
                                ? "fill-primary text-primary"
                                : "text-muted-foreground hover:text-primary"
                            )}
                          />
                        </button>

                        {exercise.image_url ? (
                          <div className="w-full aspect-[4/3] overflow-hidden bg-muted">
                            <img
                              src={exercise.image_url}
                              alt={getExerciseName(exercise.name, exercise.name_translations)}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ) : (
                          <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
                            {exercise.type === "weighted" ? (
                              <Dumbbell className="h-12 w-12 text-muted-foreground" />
                            ) : exercise.type === "cardio" ? (
                              <Activity className="h-12 w-12 text-muted-foreground" />
                            ) : exercise.type === "timed" ? (
                              <Timer className="h-12 w-12 text-muted-foreground" />
                            ) : (
                              <User className="h-12 w-12 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div className="p-3 bg-card">
                          <p className="font-medium text-foreground text-center">{getExerciseName(exercise.name, exercise.name_translations)}</p>
                          <p className="text-xs text-muted-foreground text-center">
                            {exercise.type === "weighted" ? t("progress.weighted") :
                             exercise.type === "cardio" ? t("progress.cardio") :
                             exercise.type === "timed" ? t("progress.timed") :
                             t("progress.bodyweight")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            </>
          ) : (
            <div className="space-y-4 mt-4">
              {!(selectedExercise.type === "timed" && showTimer) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDialogChange(false)}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t("common.back")}
                </Button>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleAddSet(); }}>
                {selectedExercise.type === "cardio" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("workout.distance")} ({units.distance})</Label>
                      <Input
                        id="add-distance"
                        type="number"
                        inputMode="decimal"
                        enterKeyHint="next"
                        step="0.1"
                        placeholder="5.5"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); document.getElementById('add-duration')?.focus(); } }}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("workout.timeMin")}</Label>
                      <Input
                        id="add-duration"
                        type="number"
                        inputMode="numeric"
                        enterKeyHint="done"
                        placeholder="30"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                      />
                    </div>
                  </div>
                ) : selectedExercise.type === "timed" ? (
                  showTimer ? (
                    <ExerciseTimer
                      onSave={(seconds) => {
                        setDuration(seconds.toString());
                        setShowTimer(false);
                      }}
                      onCancel={() => setShowTimer(false)}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t("workout.timeSec")}</Label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          enterKeyHint="done"
                          placeholder="60"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => setShowTimer(true)}
                      >
                        <Timer className="h-4 w-4" />
                        {t("workout.enableTimer")}
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("workout.reps")}</Label>
                      <Input
                        id="add-reps"
                        type="number"
                        inputMode="numeric"
                        enterKeyHint={selectedExercise.type === "weighted" ? "next" : "done"}
                        placeholder="8"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && selectedExercise.type === "weighted") { e.preventDefault(); document.getElementById('add-weight')?.focus(); } }}
                        autoFocus
                      />
                    </div>
                    {selectedExercise.type === "weighted" && (
                      <div className="space-y-2">
                        <Label>{t("workout.weight")}</Label>
                        <Input
                          id="add-weight"
                          type="number"
                          inputMode="decimal"
                          enterKeyHint="done"
                          step="0.5"
                          placeholder="18"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                        />
                        {selectedExercise.name.toLowerCase().includes("гантел") && (
                          <p className="text-xs text-muted-foreground">
                            {t("workout.dumbbellNote")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!(selectedExercise.type === "timed" && showTimer) && (
                  <Button
                    type="submit"
                    className="w-full mt-4"
                    disabled={addSet.isPending}
                  >
                    {t("common.add")}
                  </Button>
                )}
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
      )}

      {Object.keys(setsByExercise).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Dumbbell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{t("workout.noExercises")}</h3>
            <p className="text-muted-foreground text-sm">
              {t("workout.addFirstSet")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(setsByExercise).map(([exerciseId, { exercise, sets }], index) => (
            <Card
              key={exerciseId}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {exercise?.type === "weighted" ? (
                      <Dumbbell className="h-4 w-4 text-primary" />
                    ) : exercise?.type === "cardio" ? (
                      <Activity className="h-4 w-4 text-primary" />
                    ) : exercise?.type === "timed" ? (
                      <Timer className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4 text-primary" />
                    )}
                    {exercise?.name ? getExerciseName(exercise.name, exercise.name_translations) : ""}
                  </CardTitle>
                  {exercise?.image_url ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={exercise.image_url}
                        alt={getExerciseName(exercise.name, exercise.name_translations)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {exercise?.type === "weighted" ? (
                        <Dumbbell className="h-8 w-8 text-muted-foreground" />
                      ) : exercise?.type === "cardio" ? (
                        <Activity className="h-8 w-8 text-muted-foreground" />
                      ) : exercise?.type === "timed" ? (
                        <Timer className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <User className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1 px-4 pb-4">
                {/* Table Header */}
                <div className={cn(
                  "grid gap-1 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide",
                  exercise?.type === "bodyweight" || exercise?.type === "timed"
                    ? "grid-cols-[44px_1fr_48px]"
                    : "grid-cols-[44px_1fr_1fr_48px]"
                )}>
                  <div className="text-center">#</div>
                  <div className="text-center">
                    {exercise?.type === "cardio" ? t("progress.distance") :
                     exercise?.type === "timed" ? t("progress.time") :
                     t("workout.reps")}
                  </div>
                  {exercise?.type !== "bodyweight" && exercise?.type !== "timed" && (
                    <div className="text-center">
                      {exercise?.type === "cardio" ? t("progress.time") : t("workout.weight")}
                    </div>
                  )}
                  <div></div>
                </div>

                {/* Table Rows */}
                <TooltipProvider>
                {sets.sort((a, b) => a.set_number - b.set_number).map((set) => (
                  <Tooltip
                    key={set.id}
                    open={openTooltipId === set.id}
                    onOpenChange={(open) => setOpenTooltipId(open ? set.id : null)}
                  >
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "relative grid gap-1 items-center py-2 px-2 rounded-md cursor-pointer select-none",
                          exercise?.type === "bodyweight" || exercise?.type === "timed"
                            ? "grid-cols-[44px_1fr_48px]"
                            : "grid-cols-[44px_1fr_1fr_48px]",
                          recordSetIds.has(set.id)
                            ? "bg-yellow-100 dark:bg-yellow-900/30"
                            : "bg-muted/30"
                        )}
                        onClick={(e) => {
                          // Не открывать тултип если кликнули на кнопки редактирования/удаления
                          if ((e.target as HTMLElement).closest('button')) {
                            return;
                          }
                          setOpenTooltipId(openTooltipId === set.id ? null : set.id);
                        }}
                      >
                    {/* Trophy icon - absolute positioned on the left */}
                    {recordSetIds.has(set.id) && (
                      <Trophy className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-500" />
                    )}
                    <div className="text-center text-sm font-medium text-muted-foreground">
                      {set.set_number}
                    </div>

                    {editingSetId === set.id ? (
                      <>
                        {exercise?.type === "cardio" ? (
                          <>
                            <Input
                              type="number"
                              inputMode="decimal"
                              enterKeyHint="next"
                              step="0.1"
                              value={editDistance}
                              onChange={(e) => setEditDistance(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { (e.currentTarget.nextElementSibling as HTMLInputElement)?.focus(); } }}
                              className="h-7 text-center text-sm px-2"
                              placeholder={t("units.km")}
                              autoFocus
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              enterKeyHint="done"
                              value={editDuration}
                              onChange={(e) => setEditDuration(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); } }}
                              className="h-7 text-center text-sm px-2"
                              placeholder={t("units.min")}
                            />
                          </>
                        ) : exercise?.type === "timed" ? (
                          <>
                            <Input
                              type="number"
                              inputMode="numeric"
                              enterKeyHint="done"
                              value={editDuration}
                              onChange={(e) => setEditDuration(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); } }}
                              className="h-7 text-center text-sm px-2"
                              placeholder={t("units.sec")}
                              autoFocus
                            />
                          </>
                        ) : exercise?.type === "bodyweight" ? (
                          <>
                            <Input
                              type="number"
                              inputMode="numeric"
                              enterKeyHint="done"
                              value={editReps}
                              onChange={(e) => setEditReps(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); } }}
                              className="h-7 text-center text-sm px-2"
                              autoFocus
                            />
                          </>
                        ) : (
                          <>
                            <Input
                              type="number"
                              inputMode="numeric"
                              enterKeyHint="next"
                              value={editReps}
                              onChange={(e) => setEditReps(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { (e.currentTarget.nextElementSibling as HTMLInputElement)?.focus(); } }}
                              className="h-7 text-center text-sm px-2"
                              autoFocus
                            />
                            <Input
                              type="number"
                              inputMode="decimal"
                              enterKeyHint="done"
                              step="0.5"
                              value={editWeight}
                              onChange={(e) => setEditWeight(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSaveEdit(); } }}
                              className="h-7 text-center text-sm px-2"
                              placeholder="—"
                            />
                          </>
                        )}
                        <div className="flex gap-0.5 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={handleSaveEdit}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {exercise?.type === "cardio" ? (
                          <>
                            <div className="text-center text-sm font-semibold text-foreground">
                              {set.distance_km ? `${convertDistance(set.distance_km)} ${units.distance}` : '—'}
                            </div>
                            <div className="text-center text-sm font-medium text-primary">
                              {set.duration_minutes ? `${set.duration_minutes} ${t("units.min")}` : '—'}
                            </div>
                          </>
                        ) : exercise?.type === "timed" ? (
                          <>
                            <div className="text-center text-sm font-semibold text-primary">
                              {set.plank_seconds ? `${set.plank_seconds} ${t("units.sec")}` : '—'}
                            </div>
                          </>
                        ) : exercise?.type === "bodyweight" ? (
                          <>
                            <div className="text-center text-sm font-semibold text-foreground">
                              {set.reps || '—'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-center text-sm font-semibold text-foreground">
                              {set.reps || '—'}
                            </div>
                            <div className="text-center text-sm font-medium text-primary">
                              {set.weight ? `${convertWeight(set.weight)} ${units.weight}` : '—'}
                            </div>
                          </>
                        )}
                        {isOwner && !workout?.is_locked ? (
                          <div className="flex gap-0 justify-end -mr-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEditSet(set)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleDeleteSet(set.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div></div>
                        )}
                      </>
                    )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("workout.createdAt")}: {format(new Date(set.created_at), "HH:mm", { locale: dateLocale })}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                </TooltipProvider>

                {/* Add Next Set Button */}
                {isOwner && !workout?.is_locked && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 gap-1.5 h-8"
                    onClick={async () => {
                      // Найти полное упражнение из списка exercises
                      const fullExercise = exercises?.find(e => e.id === exerciseId);
                      if (fullExercise) {
                        await handleSelectExercise(fullExercise);
                        setDialogOpen(true);
                      }
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("workout.anotherSet")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notes Card */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t("workout.comment")}
            </CardTitle>
            {isOwner && !isEditingNotes && !workout?.is_locked && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditingNotes(true)}
              >
                {notes ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isOwner && isEditingNotes ? (
            <div className="space-y-2">
              <Textarea
                placeholder={t("workout.commentPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={updateWorkout.isPending}
                  className="flex-1 h-8"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {t("common.save")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setNotes(workout?.notes || "");
                    setIsEditingNotes(false);
                  }}
                  disabled={updateWorkout.isPending}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {notes || t("workout.emptyComment")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Card */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              {t("workout.photos")}
            </CardTitle>
            {isOwner && workout?.photo_url && !workout?.is_locked && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPhotoToDelete(true)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {workout?.photo_url ? (
            <div
              className="relative group cursor-pointer"
              onClick={() => setIsPhotoFullscreen(true)}
            >
              <img
                src={workout.photo_url}
                alt={t("workout.workoutPhoto")}
                className="w-full rounded-lg object-cover max-h-80 transition-all duration-200 group-hover:opacity-90"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-black/50 rounded-full p-3">
                  <Maximize2 className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          ) : isOwner && !workout?.is_locked ? (
            <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              {isUploadingPhoto ? (
                <>
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t("workout.clickToAddPhoto")}</span>
                  <span className="text-xs text-muted-foreground/70">{t("workout.photoFormat")}</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoUpload}
                disabled={isUploadingPhoto}
                className="hidden"
              />
            </label>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              {t("workout.noPhotos")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Photo Confirmation Dialog */}
      <AlertDialog open={photoToDelete} onOpenChange={setPhotoToDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workout.deletePhotoTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workout.deletePhotoDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Photo Viewer - rendered via portal to document.body */}
      {isPhotoFullscreen && workout?.photo_url && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            touchAction: 'none',
          }}
          onClick={() => setIsPhotoFullscreen(false)}
        >
          <button
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              zIndex: 10,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setIsPhotoFullscreen(false);
            }}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={workout.photo_url}
            alt={t("workout.workoutPhoto")}
            style={{
              maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 32px)',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {/* Delete Set Confirmation Dialog */}
      <AlertDialog open={!!setToDelete} onOpenChange={(open) => !open && setSetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workout.deleteSetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("workout.deleteSetDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
