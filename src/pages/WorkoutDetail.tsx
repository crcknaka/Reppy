import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { format, isToday, parseISO } from "date-fns";
import { getDateLocale } from "@/lib/dateLocales";
import { useTranslation } from "react-i18next";
import { getExerciseName } from "@/lib/i18n";
import { ArrowLeft, Plus, Trash2, MessageSquare, Save, Pencil, X, Camera, Loader2, ImageIcon, Trophy, Share2, Copy, Check, Ban, Lock, Unlock, Maximize2, Dumbbell, GripVertical, BarChart3, Weight, Repeat, Route, Timer, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useUserAllTimeBests, useLockWorkout, useUnlockWorkout } from "@/hooks/useWorkouts";
import { useWorkoutShare, useCreateWorkoutShare, useDeactivateWorkoutShare } from "@/hooks/useWorkoutShare";
import {
  useOfflineSingleWorkout,
  useOfflineWorkouts,
  useOfflineAddSet,
  useOfflineDeleteSet,
  useOfflineUpdateSet,
  useOfflineUpdateWorkout,
  useOfflineExercises,
  useOfflineFavoriteExercises,
  useOfflineToggleFavoriteExercise,
  getLastSetForExercise,
  getRecentSetsForExercise,
  RecentSetData,
} from "@/offline";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { useUserProfile } from "@/hooks/useProfile";
import { uploadWorkoutPhoto, deleteWorkoutPhoto, validateImageFile, compressImage } from "@/lib/photoUpload";
import { ViewingUserBanner } from "@/components/ViewingUserBanner";
import { useUnits } from "@/hooks/useUnits";
import { useAutoFillLastSet } from "@/hooks/useAutoFillLastSet";
import { LIMITS } from "@/lib/limits";
import { WorkoutExerciseCard } from "@/components/workout/WorkoutExerciseCard";
import { CopyWorkoutDialog } from "@/components/workout/CopyWorkoutDialog";
import type { Exercise } from "@/hooks/useExercises";
import type { EditSetContext } from "@/components/workout/setDialogTypes";
import { AddExerciseDialog } from "@/components/workout/AddExerciseDialog";
import { AddOrUpdateSetDialog } from "@/components/workout/AddOrUpdateSetDialog";

// Sortable wrapper for exercise cards
function SortableExerciseCard({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative">
        {!disabled && (
          <div
            className="absolute left-1.5 top-3 z-10 p-1 text-muted-foreground/40 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default function WorkoutDetail() {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, effectiveUserId, isGuest } = useAuth();
  const { isOnline } = useOffline();
  // Use offline-first hooks for data
  const { data: allWorkouts } = useOfflineWorkouts();
  const { data: workout, isLoading: isWorkoutLoading, isFetching, isError } = useOfflineSingleWorkout(id);
  const { data: exercises } = useOfflineExercises();
  const { data: favoriteExercises } = useOfflineFavoriteExercises();
  const toggleFavorite = useOfflineToggleFavoriteExercise();
  // Use offline hooks for set and workout operations
  const addSet = useOfflineAddSet();
  const deleteSet = useOfflineDeleteSet();
  const updateSet = useOfflineUpdateSet();
  const updateWorkout = useOfflineUpdateWorkout();
  const { data: allTimeBests } = useUserAllTimeBests(workout?.user_id ?? user?.id, id);

  // Check if current user is the owner (works for both authenticated users and guests)
  const isOwner = workout?.user_id === effectiveUserId;

  // Fetch workout owner's profile for banner (only when viewing others)
  const { data: workoutOwnerProfile } = useUserProfile(!isOwner && workout ? workout.user_id : null);

  const [addExerciseDialogOpen, setAddExerciseDialogOpen] = useState(false);
  const [setDialogOpen, setSetDialogOpen] = useState(false);
  const [editSetId, setEditSetId] = useState<string | null>(null);
  const [selectedExerciseForSetDialog, setSelectedExerciseForSetDialog] = useState<Exercise | null>(null);
  const [showStickyAdd, setShowStickyAdd] = useState(false);

  // Show sticky "+" button when scrolled down past 200px
  useEffect(() => {
    const check = () => setShowStickyAdd(window.scrollY > 200);
    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => window.removeEventListener("scroll", check);
  }, []);

  // DnD for exercise reorder
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 10 },
    })
  );

  const [showCelebration, setShowCelebration] = useState(false);
  const [showRecordCelebration, setShowRecordCelebration] = useState(false);
  const prevCompletionRef = useRef<boolean | null>(null);

  // Detect when all sets become completed → trigger celebration
  const allSetsCompleted = useMemo(() => {
    if (!workout?.workout_sets || workout.workout_sets.length === 0) return false;
    return workout.workout_sets.every(s => s.is_completed);
  }, [workout?.workout_sets]);

  const isDataReady = !!workout?.workout_sets && workout.workout_sets.length > 0;

  useEffect(() => {
    if (!isDataReady) return; // Wait for real data
    if (prevCompletionRef.current === null) {
      // First time data is ready — save state, no effect
      prevCompletionRef.current = allSetsCompleted;
      return;
    }
    if (allSetsCompleted && !prevCompletionRef.current) {
      setShowCelebration(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([30, 50, 30, 50, 60]);
      }
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      prevCompletionRef.current = allSetsCompleted;
      return () => clearTimeout(timer);
    }
    prevCompletionRef.current = allSetsCompleted;
  }, [allSetsCompleted, isDataReady]);

  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(false);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recentSets, setRecentSets] = useState<RecentSetData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(5);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyExercise, setHistoryExercise] = useState<{ id: string; name: string; type: string } | null>(null);

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

  const openAddExerciseDialog = () => {
    setEditSetId(null);
    setSelectedExerciseForSetDialog(null);
    setAddExerciseDialogOpen(true);
  };

  const openSetDialogForExercise = (exercise: Exercise) => {
    setSelectedExerciseForSetDialog(exercise);
    setSetDialogOpen(true);
  };

  const handleSetDialogOpenChange = (open: boolean) => {
    setSetDialogOpen(open);
    if (!open) {
      setEditSetId(null);
      setSelectedExerciseForSetDialog(null);
    }
  };

  const handleExerciseSelectedForSetDialog = (exercise: Exercise) => {
    setEditSetId(null);
    setAddExerciseDialogOpen(false);
    openSetDialogForExercise(exercise);
  };

  // Auto-open set dialog with selected exercise if coming from Exercises page
  useEffect(() => {
    const state = location.state as { autoAddExerciseId?: string } | null;
    if (state?.autoAddExerciseId && exercises) {
      const exercise = exercises.find((e) => e.id === state.autoAddExerciseId);
      if (exercise) {
        setEditSetId(null);
        setAddExerciseDialogOpen(false);
        openSetDialogForExercise(exercise);
        // Clear the state to prevent reopening on re-render
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, exercises, navigate, location.pathname]);

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

  // Detect new personal record → trigger record celebration
  // Track actual set IDs, not just count — only fire when a NEW id appears
  const prevRecordIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!isDataReady) return; // Wait for real data
    if (prevRecordIdsRef.current === null) {
      // First time data is ready — save current set, no effect
      prevRecordIdsRef.current = new Set(recordSetIds);
      return;
    }
    // Check if there's a truly new record ID that wasn't there before
    let hasNew = false;
    for (const id of recordSetIds) {
      if (!prevRecordIdsRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    prevRecordIdsRef.current = new Set(recordSetIds);
    if (hasNew) {
      setShowRecordCelebration(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([50, 30, 80]);
      }
      const timer = setTimeout(() => setShowRecordCelebration(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [recordSetIds, isDataReady]);

  const orderedExerciseEntries = useMemo(() => {
    const entries = Object.entries(setsByExercise);
    const order = workout?.exercise_order ?? [];

    // Sort by saved order first, then by created_at for any new exercises
    const orderMap = new Map(order.map((id, i) => [id, i]));

    const toTimestamp = (value: string | null | undefined) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const timestamp = new Date(value).getTime();
      return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
    };

    return entries.sort(([aId, a], [bId, b]) => {
      const aOrder = orderMap.get(aId);
      const bOrder = orderMap.get(bId);

      // Both have saved order — use it
      if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
      // Only one has saved order — it goes first
      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;

      // Neither has saved order — fallback to created_at
      const aFirst = Math.min(...a.sets.map((set) => toTimestamp(set.created_at)));
      const bFirst = Math.min(...b.sets.map((set) => toTimestamp(set.created_at)));
      return aFirst - bFirst;
    });
  }, [setsByExercise, workout?.exercise_order]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveExerciseId(event.active.id as string);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveExerciseId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveExerciseId(null);
      const { active, over } = event;
      if (!over || active.id === over.id || !workout) return;

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(15);
      }

      const exerciseIds = orderedExerciseEntries.map(([id]) => id);
      const oldIndex = exerciseIds.indexOf(active.id as string);
      const newIndex = exerciseIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = arrayMove(exerciseIds, oldIndex, newIndex);
      updateWorkout.mutate({ workoutId: workout.id, exercise_order: newOrder });
    },
    [orderedExerciseEntries, workout, updateWorkout]
  );

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

  const loadMoreHistory = async () => {
    const exerciseId = historyExercise?.id;
    if (!exerciseId || !effectiveUserId) return;

    const newLimit = historyLimit + 5;
    try {
      const history = await getRecentSetsForExercise(exerciseId, effectiveUserId, newLimit + 1);
      if (history.length > newLimit) {
        setRecentSets(history.slice(0, newLimit));
        setHasMoreHistory(true);
      } else {
        setRecentSets(history);
        setHasMoreHistory(false);
      }
      setHistoryLimit(newLimit);
    } catch (error) {
      console.error("Failed to load more history:", error);
    }
  };

  const openExerciseHistory = async (exerciseId: string, exerciseName: string, exerciseType: string) => {
    if (!effectiveUserId) return;

    setHistoryExercise({ id: exerciseId, name: exerciseName, type: exerciseType });
    setRecentSets([]);
    setHistoryLimit(5);
    setHasMoreHistory(false);
    setHistoryDrawerOpen(true);
    setIsLoadingHistory(true);

    try {
      const history = await getRecentSetsForExercise(exerciseId, effectiveUserId, 6);
      if (history.length > 5) {
        setRecentSets(history.slice(0, 5));
        setHasMoreHistory(true);
      } else {
        setRecentSets(history);
        setHasMoreHistory(false);
      }
    } catch (error) {
      console.error("Failed to load exercise history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const createSetForWorkout = async (payload: {
    exerciseId: string;
    setNumber: number;
    reps?: number;
    weight?: number;
    distance_km?: number;
    duration_minutes?: number;
    plank_seconds?: number;
    is_completed?: boolean;
  }) => {
    if (!workout) return;

    await addSet.mutateAsync({
      workoutId: workout.id,
      ...payload,
    });

    // Auto-append new exercise to order if not already present
    const currentOrder = workout.exercise_order ?? [];
    if (!currentOrder.includes(payload.exerciseId)) {
      updateWorkout.mutate({
        workoutId: workout.id,
        exercise_order: [...currentOrder, payload.exerciseId],
      });
    }
  };

  const createSetForCopyWorkout = async (payload: {
    exerciseId: string;
    setNumber: number;
    reps?: number;
    weight?: number;
    distance_km?: number;
    duration_minutes?: number;
    plank_seconds?: number;
    is_completed?: boolean;
  }) => {
    if (!workout) {
      throw new Error("Workout not found");
    }

    const createdSet = await addSet.mutateAsync({
      workoutId: workout.id,
      ...payload,
    });

    if (!createdSet?.id) {
      throw new Error("Failed to create workout set");
    }

    // Auto-append new exercise to order if not already present
    const currentOrder = workout.exercise_order ?? [];
    if (!currentOrder.includes(payload.exerciseId)) {
      updateWorkout.mutate({
        workoutId: workout.id,
        exercise_order: [...currentOrder, payload.exerciseId],
      });
    }

    return { id: createdSet.id };
  };

  const updateWorkoutSet = async (payload: {
    setId: string;
    reps?: number | null;
    weight?: number | null;
    distance_km?: number | null;
    duration_minutes?: number | null;
    plank_seconds?: number | null;
    is_completed?: boolean;
  }) => {
    await updateSet.mutateAsync(payload);
  };

  const toggleWorkoutSetCompleted = async (setId: string, isCompleted: boolean) => {
    await updateWorkoutSet({
      setId,
      is_completed: isCompleted,
    });
  };

  const deleteWorkoutSet = async (setId: string) => {
    await deleteSet.mutateAsync(setId);
  };

  const handleAddAnotherSet = async (exerciseId: string) => {
    const exercise = (exercises ?? []).find((entry) => entry.id === exerciseId);
    if (!exercise) return;

    setEditSetId(null);
    setAddExerciseDialogOpen(false);
    openSetDialogForExercise(exercise);
  };

  const handleEditSetFromCard = (set: {
    id: string;
  }) => {
    const resolved = resolveEditSetById(set.id);
    if (!resolved) {
      toast.error(t("workout.setUpdateError"));
      return;
    }

    const exercise = (exercises ?? []).find((entry) => entry.id === resolved.exerciseId);
    if (!exercise) {
      toast.error(t("workout.enterExercise"));
      return;
    }

    setEditSetId(set.id);
    setAddExerciseDialogOpen(false);
    openSetDialogForExercise(exercise);
  };

  const resolveEditSetById = (setId: string): EditSetContext | null => {
    const targetSet = workout?.workout_sets?.find((set) => set.id === setId);
    if (!targetSet) return null;

    return {
      setId: targetSet.id,
      exerciseId: targetSet.exercise_id,
      reps: targetSet.reps,
      weight: targetSet.weight,
      distance_km: targetSet.distance_km,
      duration_minutes: targetSet.duration_minutes,
      plank_seconds: targetSet.plank_seconds,
    };
  };

  const editContextForSetDialog = editSetId ? resolveEditSetById(editSetId) : null;

  const handleToggleFavoriteForDialog = async (exerciseId: string, isFavorite: boolean) => {
    await toggleFavorite.mutateAsync({ exerciseId, isFavorite });
  };

  const handleSaveNotes = async () => {
    if (!workout) return;

    if (notes.trim().length > LIMITS.MAX_NOTES_LENGTH) {
      toast.error(t("limits.maxNotesLength", { max: LIMITS.MAX_NOTES_LENGTH }));
      return;
    }

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

    // Close the drawer immediately after file selection
    setIsPhotoSourceOpen(false);

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
    <div className="space-y-6 animate-fade-in relative">
      {/* Fixed "+" button — appears top-right when scrolled past main Add Exercise button */}
      {isOwner && !workout?.is_locked && createPortal(
        <Button
          onClick={openAddExerciseDialog}
          className={cn(
            "fixed bottom-24 right-4 md:right-8 shadow-lg z-[9999] transition-all duration-200",
            showStickyAdd ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          )}
          size="icon"
        >
          <Plus className="h-5 w-5" />
        </Button>,
        document.body
      )}
      {/* Celebration animation on 100% completion */}
      {showCelebration && createPortal(
        <div className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-xl"
              style={{
                left: `${5 + Math.random() * 90}%`,
                top: "-5%",
                animation: `celebration-fall ${1.5 + Math.random() * 1}s ease-in forwards`,
                animationDelay: `${Math.random() * 0.6}s`,
              }}
            >
              {["💪", "🔥", "⭐", "🏆", "✅"][i % 5]}
            </span>
          ))}
          <style>{`
            @keyframes celebration-fall {
              0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
              100% { transform: translateY(100vh) rotate(360deg) scale(0.5); opacity: 0; }
            }
          `}</style>
        </div>,
        document.body
      )}
      {/* Record celebration — golden trophies rising */}
      {showRecordCelebration && createPortal(
        <div className="fixed inset-0 z-[99999] pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => {
            const size = [0.8, 1, 1.2, 1.5, 1.8, 2.2][Math.floor(Math.random() * 6)];
            return (
              <span
                key={i}
                className="absolute"
                style={{
                  left: `${5 + Math.random() * 90}%`,
                  bottom: "-5%",
                  fontSize: `${size}rem`,
                  animation: `record-rise ${2.5 + Math.random() * 1.5}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
                  animationDelay: `${Math.random() * 0.8}s`,
                }}
              >
                {["🏆", "🏆", "🏆", "👑", "✨", "🥇"][i % 6]}
              </span>
            );
          })}
          <style>{`
            @keyframes record-rise {
              0% { transform: translateY(0) scale(0.3) rotate(0deg); opacity: 0; }
              10% { opacity: 0.8; }
              25% { transform: translateY(-20vh) scale(1) rotate(5deg); opacity: 1; }
              75% { opacity: 0.6; }
              100% { transform: translateY(-110vh) scale(0.7) rotate(-10deg); opacity: 0; }
            }
          `}</style>
        </div>,
        document.body
      )}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
          // If viewing someone else's workout, go back to their workouts list
          if (!isOwner && workout?.user_id) {
            navigate(`/?user=${workout.user_id}`);
          } else {
            navigate("/");
          }
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 space-y-1">
          <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
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
        {isOwner && (
          <>
            <CopyWorkoutDialog
              enabled={isOwner && !workout?.is_locked}
              currentWorkout={workout}
              allWorkouts={allWorkouts}
              dateLocale={dateLocale}
              onCreateSet={createSetForCopyWorkout}
              onDeleteSet={deleteWorkoutSet}
            />

            {!isGuest && (
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("workout.shareWorkout")}</DialogTitle>
                    <DialogDescription className="sr-only">
                      {t("workout.shareWorkout")}
                    </DialogDescription>
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
                          {workoutShare.expires_at && (
                            <p className="text-xs text-muted-foreground">
                              {t("workout.linkExpiresAt", { date: format(new Date(workoutShare.expires_at), "d MMM yyyy", { locale: dateLocale }) })}
                            </p>
                          )}
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
            )}

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
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <Lock className="h-4 w-4" />
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
                className="h-8 w-8"
                onClick={handleLockWorkout}
                disabled={lockWorkout.isPending}
              >
                <Unlock className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {!isOwner && workoutOwnerProfile && (
        <ViewingUserBanner
          avatar={workoutOwnerProfile.avatar}
          displayName={workoutOwnerProfile.display_name}
          onClose={() => navigate(`/?user=${workout.user_id}`)}
        />
      )}

      {isOwner && !workout?.is_locked && (
        <>
          <Button
            onClick={openAddExerciseDialog}
            className="w-full gap-2 shadow-lg"
          >
            <Plus className="h-4 w-4" />
            {t("workout.addExercise")}
          </Button>

          <AddExerciseDialog
            open={addExerciseDialogOpen}
            onOpenChange={setAddExerciseDialogOpen}
            exercises={exercises ?? []}
            favoriteExerciseIds={favoriteExercises ?? new Set<string>()}
            onToggleFavorite={handleToggleFavoriteForDialog}
            onSelectExercise={handleExerciseSelectedForSetDialog}
          />

          <AddOrUpdateSetDialog
            open={setDialogOpen}
            onOpenChange={handleSetDialogOpenChange}
            selectedExercise={selectedExerciseForSetDialog}
            mode={editSetId ? "edit" : "add"}
            editSetId={editSetId}
            editContext={editContextForSetDialog}
            dateLocale={dateLocale}
            effectiveUserId={effectiveUserId ?? null}
            autoFillEnabled={autoFillEnabled}
            units={units}
            convertWeight={convertWeight}
            convertDistance={convertDistance}
            toMetricWeight={toMetricWeight}
            toMetricDistance={toMetricDistance}
            existingSetCountByExercise={Object.fromEntries(
              Object.entries(setsByExercise).map(([exerciseId, data]) => [exerciseId, data.sets.length])
            )}
            totalSetCount={workout.workout_sets.length}
            isSubmitting={addSet.isPending || updateSet.isPending}
            onGetRecentSets={getRecentSetsForExercise}
            onGetLastSet={getLastSetForExercise}
            onAddSet={createSetForWorkout}
            onUpdateSet={updateWorkoutSet}
          />
        </>
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
        <>
        {/* Overall workout progress */}
        {workout.workout_sets && workout.workout_sets.length > 0 && (() => {
          const total = workout.workout_sets.length;
          const completed = workout.workout_sets.filter(s => s.is_completed).length;
          const pct = Math.round((completed / total) * 100);
          return (
            <div className="h-[3px] bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/40 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          );
        })()}
        <DndContext
          sensors={dndSensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={orderedExerciseEntries.map(([id]) => id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {orderedExerciseEntries.map(([exerciseId, { exercise, sets }], index) => (
                <SortableExerciseCard
                  key={exerciseId}
                  id={exerciseId}
                  disabled={!isOwner || !!workout?.is_locked}
                >
                  <WorkoutExerciseCard
                    exerciseId={exerciseId}
                    exercise={exercise}
                    sets={sets}
                    index={index}
                    isOwner={isOwner}
                    isLocked={!!workout?.is_locked}
                    isRecordSet={(setId) => recordSetIds.has(setId)}
                    dateLocale={dateLocale}
                    onOpenExerciseHistory={openExerciseHistory}
                    onAddAnotherSet={handleAddAnotherSet}
                    onCreateSet={createSetForWorkout}
                    onEditSet={handleEditSetFromCard}
                    onDeleteSet={deleteWorkoutSet}
                    onToggleSetCompleted={toggleWorkoutSetCompleted}
                  />
                </SortableExerciseCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
        </>
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
                maxLength={LIMITS.MAX_NOTES_LENGTH}
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

      {/* Workout Stats */}
      {workout.workout_sets && workout.workout_sets.length > 0 && (() => {
        const sets = workout.workout_sets;
        const exerciseCount = Object.keys(setsByExercise).length;
        const totalSets = sets.length;
        const completedSets = sets.filter(s => s.is_completed).length;
        const totalVolume = sets.reduce((sum, s) => sum + ((s.reps || 0) * (s.weight || 0)), 0);
        const totalReps = sets.reduce((sum, s) => sum + (s.reps || 0), 0);
        const totalDistance = sets.reduce((sum, s) => sum + (s.distance_km || 0), 0);
        const totalDurationMin = sets.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        const totalPlankSec = sets.reduce((sum, s) => sum + (s.plank_seconds || 0), 0);
        const records = recordSetIds.size;

        const formattedVolume = totalVolume >= 1000
          ? `${(convertWeight(totalVolume) / 1000).toFixed(1)} t`
          : `${Math.round(convertWeight(totalVolume))} ${units.weight}`;

        return (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                {t("progress.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5 text-sm">
                  <Dumbbell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{exerciseCount} {t("workout.exercisesShort")}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Repeat className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">{completedSets}/{totalSets} {t("workout.setsShort")}</span>
                </div>
                {totalVolume > 0 && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Weight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{formattedVolume}</span>
                  </div>
                )}
                {totalReps > 0 && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{totalReps} {t("units.reps")}</span>
                  </div>
                )}
                {totalDistance > 0 && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Route className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{convertDistance(totalDistance).toFixed(1)} {units.distance}</span>
                  </div>
                )}
                {totalDurationMin > 0 && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Timer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{totalDurationMin} {t("units.min")}</span>
                  </div>
                )}
                {totalPlankSec > 0 && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Timer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{totalPlankSec} {t("units.sec")}</span>
                  </div>
                )}
                {records > 0 && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    <span className="text-muted-foreground">{records} {records === 1 ? "record" : "records"}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
            <>
              {/* Mobile: show drawer with camera/gallery options */}
              <Drawer open={isPhotoSourceOpen} onOpenChange={setIsPhotoSourceOpen}>
                <DrawerTrigger asChild>
                  <div
                    className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors md:hidden"
                  >
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
                  </div>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>{t("workout.addPhoto")}</DrawerTitle>
                  </DrawerHeader>
                  <div className="p-4 pb-8 space-y-3">
                    <Button
                      variant="outline"
                      className="w-full h-14 justify-start gap-3 text-base"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="h-5 w-5" />
                      {t("workout.takePhoto")}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-14 justify-start gap-3 text-base"
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      <ImageIcon className="h-5 w-5" />
                      {t("workout.chooseFromGallery")}
                    </Button>
                  </div>
                </DrawerContent>
              </Drawer>
              {/* Desktop: click directly opens file picker */}
              <div
                className="hidden md:flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => galleryInputRef.current?.click()}
              >
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
              </div>
              {/* Hidden inputs for camera and gallery */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </>
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
      {/* Exercise History Drawer */}
      <Drawer open={historyDrawerOpen} onOpenChange={setHistoryDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{historyExercise?.name} - {t("workout.recentSets")}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : recentSets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("workout.noHistory")}</p>
            ) : (
              <div className="space-y-2">
                {recentSets.map((set, i) => {
                  const showDate = i === 0 || set.date !== recentSets[i - 1].date;
                  return (
                    <div key={i}>
                      {showDate && (
                        <div className="text-xs text-muted-foreground mb-1 mt-2 first:mt-0">
                          {format(parseISO(set.date), "d MMM yyyy", { locale: dateLocale })}
                        </div>
                      )}
                      <div className="text-sm p-3 bg-muted/50 rounded-md">
                        <div className="font-medium">
                          {historyExercise?.type === "cardio" ? (
                            <>{convertDistance(set.distance_km || 0)} {units.distance} · {set.duration_minutes} {t("units.min")}</>
                          ) : historyExercise?.type === "timed" ? (
                            <>{set.plank_seconds} {t("units.sec")}</>
                          ) : historyExercise?.type === "bodyweight" ? (
                            <>{set.reps} {t("units.reps")}</>
                          ) : (
                            <>{set.reps} {t("units.reps")} × {convertWeight(set.weight || 0)} {units.weight}</>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {hasMoreHistory && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full mt-3"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      loadMoreHistory();
                    }}
                  >
                    {t("workout.loadMoreHistory")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

    </div>
  );
}
