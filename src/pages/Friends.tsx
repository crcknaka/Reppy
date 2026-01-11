import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, Inbox, Send, UserX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { FriendCard } from "@/components/FriendCard";
import { AddFriendDialog } from "@/components/AddFriendDialog";
import {
  useFriends,
  usePendingFriendRequests,
  useSentFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useRemoveFriend,
  useCancelFriendRequest,
} from "@/hooks/useFriends";
import { toast } from "sonner";

export default function Friends() {
  const navigate = useNavigate();
  const [friendToRemove, setFriendToRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: pendingRequests, isLoading: pendingLoading } = usePendingFriendRequests();
  const { data: sentRequests, isLoading: sentLoading } = useSentFriendRequests();

  const acceptRequest = useAcceptFriendRequest();
  const rejectRequest = useRejectFriendRequest();
  const removeFriend = useRemoveFriend();
  const cancelRequest = useCancelFriendRequest();

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptRequest.mutateAsync(friendshipId);
      toast.success("Запрос принят");
    } catch {
      toast.error("Ошибка при принятии запроса");
    }
  };

  const handleReject = async (friendshipId: string) => {
    try {
      await rejectRequest.mutateAsync(friendshipId);
      toast.success("Запрос отклонен");
    } catch {
      toast.error("Ошибка при отклонении запроса");
    }
  };

  const handleRemoveFriend = async () => {
    if (!friendToRemove) return;
    try {
      await removeFriend.mutateAsync(friendToRemove.id);
      toast.success("Друг удален");
      setFriendToRemove(null);
    } catch {
      toast.error("Ошибка при удалении друга");
    }
  };

  const handleCancelRequest = async (friendshipId: string) => {
    try {
      await cancelRequest.mutateAsync(friendshipId);
      toast.success("Запрос отменен");
    } catch {
      toast.error("Ошибка при отмене запроса");
    }
  };

  const pendingCount = pendingRequests?.length || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Друзья
          </h1>
          <p className="text-muted-foreground text-sm">
            {friends?.length || 0} {friends?.length === 1 ? "друг" : friends?.length && friends.length >= 2 && friends.length <= 4 ? "друга" : "друзей"}
          </p>
        </div>
        <AddFriendDialog
          trigger={
            <Button className="gap-2 shadow-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold transition-all hover:shadow-xl hover:scale-105 active:scale-95">
              <UserPlus className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Добавить</span>
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="friends" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Мои друзья</span>
            <span className="sm:hidden">Друзья</span>
          </TabsTrigger>
          <TabsTrigger value="incoming" className="gap-1.5 text-xs sm:text-sm relative">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Входящие</span>
            <span className="sm:hidden">Входящие</span>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full px-1">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="gap-1.5 text-xs sm:text-sm">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Исходящие</span>
            <span className="sm:hidden">Исходящие</span>
          </TabsTrigger>
        </TabsList>

        {/* My Friends Tab */}
        <TabsContent value="friends" className="mt-4">
          {friendsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-[72px] bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          ) : friends?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Нет друзей</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Найди друзей и тренируйтесь вместе!
                </p>
                <AddFriendDialog />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {friends?.map((friendship, index) => (
                <div
                  key={friendship.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <FriendCard
                    avatar={friendship.friend.avatar}
                    displayName={friendship.friend.display_name}
                    status="friend"
                    onRemove={() =>
                      setFriendToRemove({
                        id: friendship.id,
                        name: friendship.friend.display_name || "Аноним",
                      })
                    }
                    onClick={() => navigate(`/?user=${friendship.friend.user_id}`)}
                    isLoading={removeFriend.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Incoming Requests Tab */}
        <TabsContent value="incoming" className="mt-4">
          {pendingLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-[72px] bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          ) : pendingRequests?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Нет входящих запросов</h3>
                <p className="text-muted-foreground text-sm">
                  Когда кто-то захочет добавить вас в друзья, запрос появится здесь
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pendingRequests?.map((request, index) => (
                <div
                  key={request.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <FriendCard
                    avatar={request.requester.avatar}
                    displayName={request.requester.display_name}
                    status="incoming"
                    onAccept={() => handleAccept(request.id)}
                    onReject={() => handleReject(request.id)}
                    isLoading={acceptRequest.isPending || rejectRequest.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Outgoing Requests Tab */}
        <TabsContent value="outgoing" className="mt-4">
          {sentLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-[72px] bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          ) : sentRequests?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Send className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Нет исходящих запросов</h3>
                <p className="text-muted-foreground text-sm">
                  Здесь будут отображаться ваши отправленные запросы на дружбу
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sentRequests?.map((request, index) => (
                <div
                  key={request.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <FriendCard
                    avatar={request.addressee.avatar}
                    displayName={request.addressee.display_name}
                    status="outgoing"
                    onCancel={() => handleCancelRequest(request.id)}
                    isLoading={cancelRequest.isPending}
                  />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Remove Friend Confirmation Dialog */}
      <AlertDialog open={!!friendToRemove} onOpenChange={(open) => !open && setFriendToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              Удалить друга?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить <strong>{friendToRemove?.name}</strong> из друзей?
              Вы больше не сможете видеть тренировки друг друга.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFriend}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
