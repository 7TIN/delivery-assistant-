import { useState } from "react";
import { Plus, RefreshCcw, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

const inputClassName =
  "h-11 rounded-2xl border border-border/80 bg-background/70 px-4 text-sm outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10";

const DEFAULT_USERS: string[] = ["user_demo"];

const ROUTE_COLORS = [
  { bg: "#3b82f6", border: "#2563eb", name: "Blue" },
  { bg: "#f97316", border: "#ea580c", name: "Orange" },
  { bg: "#ec4899", border: "#db2777", name: "Pink" },
  { bg: "#8b5cf6", border: "#7c3aed", name: "Purple" },
  { bg: "#14b8a6", border: "#0d9488", name: "Teal" },
  { bg: "#eab308", border: "#ca8a04", name: "Yellow" },
  { bg: "#ef4444", border: "#dc2626", name: "Red" },
  { bg: "#22c55e", border: "#16a34a", name: "Green" },
];

export function getRouteColor(index: number) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

export function UserControl({
  onRefresh,
  isRefreshing,
}: {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}) {
  const [users, setUsers] = usePersistentState<string[]>("delivery.users", DEFAULT_USERS);
  const [selectedUser, setSelectedUser] = usePersistentState<string>("delivery.userId", "user_demo");
  const [newUserId, setNewUserId] = useState("");

  const handleAddUser = () => {
    const trimmed = newUserId.trim();
    if (trimmed && !users.includes(trimmed)) {
      const updatedUsers = [...users, trimmed];
      setUsers(updatedUsers);
      setSelectedUser(trimmed);
      setNewUserId("");
    }
  };

  const handleRemoveUser = (userId: string) => {
    if (users.length <= 1) return;
    const updatedUsers = users.filter((u) => u !== userId);
    setUsers(updatedUsers);
    if (selectedUser === userId) {
      setSelectedUser(updatedUsers[0]);
    }
  };

  return (
    <div className="rounded-[1.25rem] border border-border/60 bg-background/70 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">User Control</p>
          <h3 className="text-base font-semibold tracking-tight">Manage Users</h3>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Active Users</label>
        <div className="flex flex-wrap gap-2">
          {users.map((userId, index) => {
            const color = getRouteColor(index);
            const isSelected = userId === selectedUser;
            return (
              <button
                key={userId}
                type="button"
                onClick={() => setSelectedUser(userId)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                  isSelected
                    ? "text-white"
                    : "border border-border bg-background/70 text-muted-foreground hover:text-foreground",
                )}
                style={isSelected ? { backgroundColor: color.bg, borderColor: color.border } : undefined}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: isSelected ? "white" : color.bg }}
                />
                {userId}
                {users.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveUser(userId);
                    }}
                    className="ml-1 text-xs opacity-60 hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
            placeholder="Add new user ID"
            className={cn(inputClassName, "w-full h-9")}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl"
          onClick={handleAddUser}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {onRefresh && (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCcw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      )}

      <div className="text-xs text-muted-foreground">
        <p>Route colors:
          {ROUTE_COLORS.slice(0, Math.min(users.length, 4)).map((c) => (
            <span key={c.name} className="ml-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.bg }} />
              {c.name}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export { ROUTE_COLORS };
