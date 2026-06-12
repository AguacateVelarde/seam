import { z } from "zod";

// Release channels, in promotion order. Delivery defaults to "production";
// clients opt into earlier channels via the X-Seam-Channel header.
export const CHANNELS = ["development", "staging", "production"] as const;
export const ChannelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof ChannelSchema>;

export function nextChannel(channel: Channel): Channel | null {
  const index = CHANNELS.indexOf(channel);
  return index >= 0 && index < CHANNELS.length - 1 ? CHANNELS[index + 1] : null;
}

export const PublicationSchema = z.object({
  id: z.string().ulid(),
  screenId: z.string().ulid(),
  snapshotId: z.string().ulid(),
  experimentId: z.string().ulid().nullish(),
  channel: ChannelSchema,
  isDefault: z.boolean().default(false),
  publishedAt: z.string().datetime(),
  publishedBy: z.string().nullish(),
});

export type Publication = z.infer<typeof PublicationSchema>;

export const CreatePublicationSchema = z.object({
  snapshotId: z.string().ulid(),
  experimentId: z.string().ulid().optional(),
  channel: ChannelSchema.default("production"),
  publishedBy: z.string().optional(),
});

export const PromotePublicationSchema = z.object({
  from: ChannelSchema,
  to: ChannelSchema,
  publishedBy: z.string().optional(),
});
