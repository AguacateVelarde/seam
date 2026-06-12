import type { SeamAdapter } from "@seam/schema";

const registry = new Map<string, SeamAdapter>();

export function registerAdapter(adapter: SeamAdapter) {
  registry.set(adapter.contentType, adapter);
}

export function getAdapter(contentType: string): SeamAdapter | undefined {
  return registry.get(contentType);
}

export function getAdapterByName(name: string): SeamAdapter | undefined {
  for (const adapter of registry.values()) {
    if (adapter.name === name) return adapter;
  }
  return undefined;
}

export function listAdapters(): string[] {
  return Array.from(registry.keys());
}
