import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  useAppLogs,
  useLogStats,
  useDeleteLog,
  useClearAllLogs,
  type LogFilters,
} from "@/hooks/admin/useAppLogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Trash2,
  Loader2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Globe,
  Code,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminLogs() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const dateLocale = i18n.language === "ru" ? ru : enUS;

  // Filters
  const [filters, setFilters] = useState<LogFilters>({
    level: "all",
  });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Dialogs
  const [clearAllDialog, setClearAllDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  // Data
  const { data, isLoading, refetch } = useAppLogs(filters, page, pageSize);
  const { data: stats } = useLogStats();
  const deleteLog = useDeleteLog();
  const clearAllLogs = useClearAllLogs();

  const logs = data?.logs || [];
  const totalLogs = data?.total || 0;
  const totalPages = Math.ceil(totalLogs / pageSize);

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput || undefined }));
    setPage(1);
  };

  const handleLevelChange = (level: string) => {
    setFilters((prev) => ({
      ...prev,
      level: level as LogFilters["level"],
    }));
    setPage(1);
  };

  const handleClearAll = async () => {
    try {
      await clearAllLogs.mutateAsync();
      toast.success(t("admin.logs.clearedAll"));
    } catch {
      toast.error(t("common.error"));
    }
    setClearAllDialog(false);
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await deleteLog.mutateAsync(logId);
      toast.success(t("admin.logs.deleted"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["appLogs"] });
    refetch();
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warn":
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "warn":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "info":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      default:
        return "bg-muted";
    }
  };

  const selectedLogData = logs.find((log) => log.id === selectedLog);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("admin.logs.title")}</h1>
            <p className="text-muted-foreground">{t("admin.logs.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setClearAllDialog(true)}
              disabled={!stats || stats.total === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("admin.logs.clearAll")}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">{t("admin.logs.total")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-500">{stats?.errors || 0}</div>
              <p className="text-xs text-muted-foreground">{t("admin.logs.errors")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-500">{stats?.warnings || 0}</div>
              <p className="text-xs text-muted-foreground">{t("admin.logs.warnings")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-500">{stats?.info || 0}</div>
              <p className="text-xs text-muted-foreground">{t("admin.logs.info")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">{stats?.todayCount || 0}</div>
              <p className="text-xs text-muted-foreground">{t("admin.logs.today")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder={t("admin.logs.searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <Select value={filters.level || "all"} onValueChange={handleLevelChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.logs.allLevels")}</SelectItem>
                  <SelectItem value="error">{t("admin.logs.errors")}</SelectItem>
                  <SelectItem value="warn">{t("admin.logs.warnings")}</SelectItem>
                  <SelectItem value="info">{t("admin.logs.info")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs list */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {t("admin.logs.noLogs")}
              </div>
            ) : (
              <div className="divide-y">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Level icon */}
                      <div className={cn("p-2 rounded-lg", getLevelColor(log.level))}>
                        {getLevelIcon(log.level)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{log.message}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(log.created_at), {
                              addSuffix: true,
                              locale: dateLocale,
                            })}
                          </span>
                          {log.profile && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.profile.display_name || log.profile.username || t("common.anonymous")}
                            </span>
                          )}
                          {log.url && (
                            <span className="flex items-center gap-1 truncate max-w-[200px]">
                              <Globe className="h-3 w-3 flex-shrink-0" />
                              {new URL(log.url).pathname}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLog(log.id);
                        }}
                        disabled={deleteLog.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("admin.logs.showing", {
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, totalLogs),
                total: totalLogs,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Log detail dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedLogData && getLevelIcon(selectedLogData.level)}
                {t("admin.logs.details")}
              </DialogTitle>
            </DialogHeader>

            {selectedLogData && (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Message */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t("admin.logs.message")}
                  </p>
                  <p className="text-sm bg-muted p-3 rounded-lg break-all">
                    {selectedLogData.message}
                  </p>
                </div>

                {/* Stack trace */}
                {selectedLogData.stack && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("admin.logs.stack")}
                    </p>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono">
                      {selectedLogData.stack}
                    </pre>
                  </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Time */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("admin.logs.time")}
                    </p>
                    <p className="text-sm">
                      {format(new Date(selectedLogData.created_at), "dd.MM.yyyy HH:mm:ss")}
                    </p>
                  </div>

                  {/* Level */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("admin.logs.level")}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                        getLevelColor(selectedLogData.level)
                      )}
                    >
                      {selectedLogData.level.toUpperCase()}
                    </span>
                  </div>

                  {/* User */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("admin.logs.user")}
                    </p>
                    {selectedLogData.profile ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-sm">
                            {selectedLogData.profile.avatar || <User className="h-3 w-3" />}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {selectedLogData.profile.display_name || selectedLogData.profile.username}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("common.anonymous")}
                      </span>
                    )}
                  </div>

                  {/* URL */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">URL</p>
                    <p className="text-sm truncate" title={selectedLogData.url || undefined}>
                      {selectedLogData.url || "—"}
                    </p>
                  </div>
                </div>

                {/* User agent */}
                {selectedLogData.user_agent && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">User Agent</p>
                    <p className="text-xs bg-muted p-2 rounded break-all">
                      {selectedLogData.user_agent}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                {selectedLogData.metadata && Object.keys(selectedLogData.metadata).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {t("admin.logs.metadata")}
                    </p>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto font-mono">
                      {JSON.stringify(selectedLogData.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Clear all dialog */}
        <AlertDialog open={clearAllDialog} onOpenChange={setClearAllDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.logs.clearAllTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.logs.clearAllDescription", { count: stats?.total || 0 })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {clearAllLogs.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {t("admin.logs.clearAll")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
