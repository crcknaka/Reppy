import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminUsers, useSetAdminStatus, useDeleteUser } from "@/hooks/admin/useAdminUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Search, Shield, ShieldOff, User, Loader2, Dumbbell, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminUsers() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [adminDialog, setAdminDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    makeAdmin: boolean;
  }>({ open: false, userId: "", userName: "", makeAdmin: false });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
  }>({ open: false, userId: "", userName: "" });

  const { data: users, isLoading } = useAdminUsers(search);
  const setAdminMutation = useSetAdminStatus();
  const deleteUserMutation = useDeleteUser();

  const handleToggleAdmin = async () => {
    try {
      await setAdminMutation.mutateAsync({
        userId: adminDialog.userId,
        isAdmin: adminDialog.makeAdmin,
      });
      toast.success(
        adminDialog.makeAdmin
          ? t("admin.users.madeAdmin", { name: adminDialog.userName })
          : t("admin.users.removedAdmin", { name: adminDialog.userName })
      );
    } catch {
      toast.error(t("common.error"));
    }
    setAdminDialog({ open: false, userId: "", userName: "", makeAdmin: false });
  };

  const handleDeleteUser = async () => {
    try {
      await deleteUserMutation.mutateAsync(deleteDialog.userId);
      toast.success(t("admin.users.userDeleted", { name: deleteDialog.userName }));
    } catch {
      toast.error(t("common.error"));
    }
    setDeleteDialog({ open: false, userId: "", userName: "" });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.nav.users")}</h1>
          <p className="text-muted-foreground">{t("admin.usersDesc")}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.users.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t("admin.users.list")}</span>
              <Badge variant="secondary">{users?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users && users.length > 0 ? (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/?user=${user.user_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback>
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.display_name || t("common.anonymous")}
                          </span>
                          {user.username && (
                            <span
                              className="text-sm text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(`@${user.username}`);
                                toast.success(t("common.copied"));
                              }}
                            >
                              @{user.username}
                            </span>
                          )}
                          {user.is_admin && (
                            <Badge variant="default" className="text-xs">
                              {t("settings.admin")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Dumbbell className="h-3 w-3" />
                            {user.workout_count}
                          </span>
                          {user.last_workout_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(user.last_workout_date), "dd.MM.yy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant={user.is_admin ? "outline" : "secondary"}
                        size="icon"
                        className="h-8 w-8"
                        title={user.is_admin ? t("admin.users.removeAdmin") : t("admin.users.makeAdmin")}
                        onClick={() =>
                          setAdminDialog({
                            open: true,
                            userId: user.user_id,
                            userName: user.display_name || t("common.anonymous"),
                            makeAdmin: !user.is_admin,
                          })
                        }
                      >
                        {user.is_admin ? (
                          <ShieldOff className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title={t("admin.users.deleteUser")}
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            userId: user.user_id,
                            userName: user.display_name || t("common.anonymous"),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {t("common.noData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Toggle Admin Dialog */}
        <AlertDialog
          open={adminDialog.open}
          onOpenChange={(open) =>
            setAdminDialog((prev) => ({ ...prev, open }))
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {adminDialog.makeAdmin
                  ? t("admin.users.confirmMakeAdmin")
                  : t("admin.users.confirmRemoveAdmin")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {adminDialog.makeAdmin
                  ? t("admin.users.confirmMakeAdminDesc", {
                      name: adminDialog.userName,
                    })
                  : t("admin.users.confirmRemoveAdminDesc", {
                      name: adminDialog.userName,
                    })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleToggleAdmin}>
                {t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete User Dialog */}
        <AlertDialog
          open={deleteDialog.open}
          onOpenChange={(open) =>
            setDeleteDialog((prev) => ({ ...prev, open }))
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                {t("admin.users.confirmDeleteUser")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.users.confirmDeleteUserDesc", {
                  name: deleteDialog.userName,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
