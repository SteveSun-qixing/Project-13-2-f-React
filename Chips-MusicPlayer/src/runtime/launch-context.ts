import type { Client, PlatformLaunchContext } from "chips-sdk";

export function readLaunchContext(client: Client): PlatformLaunchContext {
  try {
    return client.platform.getLaunchContext();
  } catch {
    return { launchParams: {} };
  }
}

