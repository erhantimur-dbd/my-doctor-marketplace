import { PostHog } from "posthog-node";
import {
  getPostHogHost,
  getPostHogKey,
  isPostHogConfigured,
  scrubAnalyticsProps,
} from "@/lib/analytics/config";
import type {
  AnalyticsEventName,
  AnalyticsProps,
} from "@/lib/analytics/events";

let serverClient: PostHog | null = null;

function getServerClient(): PostHog | null {
  if (!isPostHogConfigured()) return null;
  if (serverClient) return serverClient;
  const key = getPostHogKey();
  if (!key) return null;
  serverClient = new PostHog(key, {
    host: getPostHogHost(),
    flushAt: 1,
    flushInterval: 0,
  });
  return serverClient;
}

export async function trackServer(
  distinctId: string,
  event: AnalyticsEventName,
  props?: AnalyticsProps
): Promise<void> {
  const client = getServerClient();
  if (!client) return;
  const id = distinctId?.trim() || "anonymous";
  if (id.includes("@")) return;
  try {
    client.capture({
      distinctId: id,
      event,
      properties: {
        ...scrubAnalyticsProps(props),
        surface: props?.surface ?? "server",
        $lib: "md360-server",
      },
    });
    await client.flush();
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[analytics] server capture failed:", err);
    }
  }
}
