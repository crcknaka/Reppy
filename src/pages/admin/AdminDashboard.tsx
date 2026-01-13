import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminStats, useUniqueExercises } from "@/hooks/admin/useAdminStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Activity,
  Calendar,
  Dumbbell,
  TrendingUp,
  Trophy,
  UserPlus,
  Hash,
  BarChart3,
  Loader2,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  onClick,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useAdminStats();
  const [exercisesDialogOpen, setExercisesDialogOpen] = useState(false);
  const { data: uniqueExercises, isLoading: exercisesLoading } = useUniqueExercises();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.nav.dashboard")}</h1>
          <p className="text-muted-foreground">{t("admin.dashboardDesc")}</p>
        </div>

        {/* Users Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("admin.stats.usersSection")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title={t("admin.stats.totalUsers")}
                  value={stats?.totalUsers || 0}
                  icon={Users}
                />
                <StatCard
                  title={t("admin.stats.activeUsers7d")}
                  value={stats?.activeUsers7d || 0}
                  icon={Users}
                  description={t("admin.stats.last7days")}
                />
                <StatCard
                  title={t("admin.stats.newUsersThisWeek")}
                  value={stats?.newUsersThisWeek || 0}
                  icon={UserPlus}
                  description={t("admin.stats.last7days")}
                />
                <StatCard
                  title={t("admin.stats.newUsersThisMonth")}
                  value={stats?.newUsersThisMonth || 0}
                  icon={UserPlus}
                  description={t("admin.stats.last30days")}
                />
              </>
            )}
          </div>
        </div>

        {/* Workouts Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("admin.stats.workoutsSection")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title={t("admin.stats.totalWorkouts")}
                  value={stats?.totalWorkouts || 0}
                  icon={Activity}
                />
                <StatCard
                  title={t("admin.stats.workoutsToday")}
                  value={stats?.workoutsToday || 0}
                  icon={Calendar}
                />
                <StatCard
                  title={t("admin.stats.workoutsThisWeek")}
                  value={stats?.workoutsThisWeek || 0}
                  icon={Calendar}
                  description={t("admin.stats.last7days")}
                />
                <StatCard
                  title={t("admin.stats.workoutsThisMonth")}
                  value={stats?.workoutsThisMonth || 0}
                  icon={Calendar}
                  description={t("admin.stats.last30days")}
                />
              </>
            )}
          </div>
        </div>

        {/* Activity Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("admin.stats.activitySection")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title={t("admin.stats.totalSets")}
                  value={stats?.totalSets || 0}
                  icon={Hash}
                />
                <StatCard
                  title={t("admin.stats.totalExercises")}
                  value={stats?.totalExercises || 0}
                  icon={Dumbbell}
                  onClick={() => setExercisesDialogOpen(true)}
                />
                <StatCard
                  title={t("admin.stats.avgWorkoutsPerUser")}
                  value={stats?.avgWorkoutsPerUser || 0}
                  icon={TrendingUp}
                />
                <StatCard
                  title={t("admin.stats.avgSetsPerWorkout")}
                  value={stats?.avgSetsPerWorkout || 0}
                  icon={BarChart3}
                />
              </>
            )}
          </div>
        </div>

        {/* Top Exercises */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t("admin.stats.topExercises")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            ) : stats?.topExercises && stats.topExercises.length > 0 ? (
              <div className="space-y-3">
                {stats.topExercises.map((exercise, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <Dumbbell className="h-4 w-4 text-primary" />
                      <span className="font-medium">{exercise.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {exercise.count} {t("admin.stats.uses")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                {t("common.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("admin.stats.topUsers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : stats?.topUsers && stats.topUsers.length > 0 ? (
              <div className="space-y-3">
                {stats.topUsers.map((user, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback>
                          {user.name?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="font-medium block truncate">{user.name}</span>
                        {user.username && (
                          <span
                            className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                            onClick={() => {
                              navigator.clipboard.writeText(`@${user.username}`);
                              toast.success(t("common.copied"));
                            }}
                          >
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {user.workoutCount} {t("admin.users.workouts")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                {t("common.noData")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unique Exercises Dialog */}
      <Dialog open={exercisesDialogOpen} onOpenChange={setExercisesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              {t("admin.stats.uniqueExercises")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {exercisesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : uniqueExercises && uniqueExercises.length > 0 ? (
              uniqueExercises.map((exercise) => (
                <div
                  key={exercise.exerciseId}
                  className="p-3 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <span className="font-medium">{exercise.exerciseName}</span>
                    <span className="text-xs text-muted-foreground">
                      ({exercise.users.length} {exercise.users.length === 1 ? t("admin.stats.user") : t("admin.stats.usersCount")})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {exercise.users.map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 text-xs"
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={user.avatar || undefined} />
                          <AvatarFallback>
                            <User className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                        <span>{user.displayName || t("common.anonymous")}</span>
                        {user.username && (
                          <span
                            className="text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => {
                              navigator.clipboard.writeText(`@${user.username}`);
                              toast.success(t("common.copied"));
                            }}
                          >
                            @{user.username}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {t("common.noData")}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
