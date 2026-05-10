import { useCallback } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import { LiveList, LiveMap, LiveObject } from "@liveblocks/client";
import { isValidSessionCode } from "../lib/sessionCode";
import { SessionUI } from "../components/SessionUI";

export function Session() {
  const { code } = useParams<{ code: string }>();
  const { getToken } = useAuth();
  const { user } = useUser();

  const authEndpoint = useCallback(
    async (room?: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/liveblocks-auth", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ room }),
      });
      if (!res.ok) {
        throw new Error(`Liveblocks auth failed (${res.status})`);
      }
      return await res.json();
    },
    [getToken],
  );

  const roomId = code?.toUpperCase();
  if (!roomId || !isValidSessionCode(roomId)) {
    return <Navigate to="/" replace />;
  }

  return (
    <LiveblocksProvider authEndpoint={authEndpoint}>
      <RoomProvider
        id={roomId}
        initialPresence={{ votingComplete: false }}
        initialStorage={{
          candidates: new LiveList([]),
          votes: new LiveMap(),
          consensus: new LiveObject({
            hostId: user?.id ?? "",
            threshold: { kind: "unanimous" as const },
            phase: "voting" as const,
            winnerId: null,
            tiedIds: [],
            decidedAt: null,
            candidatesPerPull: 5,
          }),
        }}
      >
        <ClientSideSuspense
          fallback={
            <main className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-muted">
              Connecting to session {roomId}…
            </main>
          }
        >
          <SessionUI code={roomId} />
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
