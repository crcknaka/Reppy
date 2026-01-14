import { useState, useEffect } from "react";
import { Search, UserPlus, Check, Clock, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchUsers, useSendFriendRequest, useFriendshipStatus } from "@/hooks/useFriends";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AddFriendDialogProps {
  trigger?: React.ReactNode;
}

interface SearchResultItemProps {
  userId: string;
  avatar: string | null;
  displayName: string | null;
  username: string | null;
  onSendRequest: (userId: string) => void;
  isPending: boolean;
}

function SearchResultItem({ userId, avatar, displayName, username, onSendRequest, isPending }: SearchResultItemProps) {
  const { t } = useTranslation();
  const { data: friendshipStatus } = useFriendshipStatus(userId);

  const getButtonContent = () => {
    if (!friendshipStatus) {
      return (
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5 text-xs"
          onClick={() => onSendRequest(userId)}
          disabled={isPending}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {t("friends.addFriend")}
        </Button>
      );
    }

    if (friendshipStatus.status === "accepted") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 px-2 py-1 rounded bg-green-500/10">
          <Check className="h-3.5 w-3.5" />
          {t("friends.alreadyFriends")}
        </div>
      );
    }

    if (friendshipStatus.status === "pending") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded bg-muted">
          <Clock className="h-3.5 w-3.5" />
          {t("friends.pending")}
        </div>
      );
    }

    // rejected - allow to send again
    return (
      <Button
        size="sm"
        variant="secondary"
        className="gap-1.5 text-xs"
        onClick={() => onSendRequest(userId)}
        disabled={isPending}
      >
        <UserPlus className="h-3.5 w-3.5" />
        {t("friends.addFriend")}
      </Button>
    );
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-xl shrink-0">
        {avatar || "👤"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {displayName || t("common.anonymous")}
        </p>
        {username && (
          <p className="text-xs text-muted-foreground truncate">@{username}</p>
        )}
      </div>
      {getButtonContent()}
    </div>
  );
}

export function AddFriendDialog({ trigger }: AddFriendDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: searchResults, isLoading: isSearching } = useSearchUsers(debouncedQuery);
  const sendRequest = useSendFriendRequest();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSendRequest = async (userId: string) => {
    try {
      await sendRequest.mutateAsync(userId);
      toast.success(t("friends.requestSent"));
    } catch (error) {
      toast.error(t("friends.requestError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t("friends.addFriend")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("friends.findFriend")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("friends.searchByName")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("friends.searchByName")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {searchQuery.length < 2 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {t("friends.enterMinChars")}
              </p>
            )}

            {searchQuery.length >= 2 && isSearching && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}

            {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {t("friends.usersNotFound")}
              </p>
            )}

            {searchResults?.map((user) => (
              <SearchResultItem
                key={user.user_id}
                userId={user.user_id}
                avatar={user.avatar}
                displayName={user.display_name}
                username={user.username}
                onSendRequest={handleSendRequest}
                isPending={sendRequest.isPending}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
