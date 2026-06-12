import type { SeamResponse } from "./seam-response";

export interface SeamAdapter {
  // Must match the subtype in "application/vnd.seam.{name}+json"
  name: string;
  contentType: string;
  transform(response: SeamResponse): unknown;
}

export const SEAM_NATIVE_CONTENT_TYPE = "application/vnd.seam+json";
