import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getChatSocket } from "../../api/realtime";

interface PresenceContextValue {
  onlineUserIds: Set<string>;
  isOnline: (userId?: string | number | null) => boolean;
  syncPresence: () => void;
}

const PresenceContext = createContext<PresenceContextValue | null>(null);

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const syncPresence = useCallback(() => {
    const socket = getChatSocket();
    if (!socket?.connected) {
      return;
    }

    socket.emit("presence:sync", {}, (response: any) => {
      if (!response?.success) {
        return;
      }

      setOnlineUserIds(
        new Set(
          (response.data?.users || [])
            .filter((user: any) => user.online)
            .map((user: any) => String(user.userId)),
        ),
      );
    });
  }, []);

  useEffect(() => {
    const socket = getChatSocket();
    if (!socket) {
      return;
    }

    const applySnapshot = (event: any) => {
      setOnlineUserIds(
        new Set(
          (event?.users || [])
            .filter((user: any) => user.online)
            .map((user: any) => String(user.userId)),
        ),
      );
    };
    const markOnline = (event: any) => {
      if (!event?.userId) {
        return;
      }
      setOnlineUserIds(current => new Set(current).add(String(event.userId)));
    };
    const markOffline = (event: any) => {
      if (!event?.userId) {
        return;
      }
      setOnlineUserIds(current => {
        const next = new Set(current);
        next.delete(String(event.userId));
        return next;
      });
    };
    const clearPresence = () => setOnlineUserIds(new Set());

    socket.on("connect", syncPresence);
    socket.on("session:ready", syncPresence);
    socket.on("presence:contacts", applySnapshot);
    socket.on("presence:online", markOnline);
    socket.on("presence:offline", markOffline);
    socket.on("conversation:created", syncPresence);
    socket.on("participant:added", syncPresence);
    socket.on("disconnect", clearPresence);

    if (socket.connected) {
      syncPresence();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", syncPresence);
      socket.off("session:ready", syncPresence);
      socket.off("presence:contacts", applySnapshot);
      socket.off("presence:online", markOnline);
      socket.off("presence:offline", markOffline);
      socket.off("conversation:created", syncPresence);
      socket.off("participant:added", syncPresence);
      socket.off("disconnect", clearPresence);
    };
  }, [syncPresence]);

  const value = useMemo(
    () => ({
      onlineUserIds,
      isOnline: (userId?: string | number | null) =>
        Boolean(userId && onlineUserIds.has(String(userId))),
      syncPresence,
    }),
    [onlineUserIds, syncPresence],
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error("usePresence must be used inside PresenceProvider");
  }
  return context;
};
