import type { Channel } from "@seam/schema";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { db } from "../db/client";
import { screenChannels } from "../db/schema";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function getChannelState(screenId: string, channel: Channel) {
  return db.query.screenChannels.findFirst({
    where: and(eq(screenChannels.screenId, screenId), eq(screenChannels.channel, channel)),
  });
}

export async function listChannelStates(screenId: string) {
  return db.query.screenChannels.findMany({
    where: eq(screenChannels.screenId, screenId),
  });
}

// Point a screen's channel at a publication (upsert), or clear it (null).
export async function setChannelState(
  tx: Tx | Db,
  screenId: string,
  channel: Channel,
  publicationId: string | null,
) {
  if (publicationId === null) {
    await tx
      .delete(screenChannels)
      .where(and(eq(screenChannels.screenId, screenId), eq(screenChannels.channel, channel)));
    return;
  }
  await tx
    .insert(screenChannels)
    .values({ screenId, channel, activePublicationId: publicationId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [screenChannels.screenId, screenChannels.channel],
      set: { activePublicationId: publicationId, updatedAt: new Date() },
    });
}
