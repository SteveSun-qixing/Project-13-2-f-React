import type { ReactElement, ReactNode } from "react";
import {
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  type ChipsClientLike,
  type ChipsLaunchContext,
  type ChipsSurfaceContext,
} from "@chips/component-library";
import { appMockLaunchContext, appMockSurfaceContext, createAppMockClient } from "./mock-environment";
import { defaultThemeState } from "../theme/theme-runtime";
import { AppRuntimeProvider } from "../app/AppRuntimeProvider";

export interface RenderWithChipsResult {
  client: ReturnType<typeof createAppMockClient>;
  element: ReactElement;
}

export function renderWithChips(children: ReactNode): RenderWithChipsResult {
  const client = createAppMockClient();
  return {
    client,
    element: (
      <ChipsEnvironmentProvider
        client={client as unknown as ChipsClientLike}
        initialTheme={defaultThemeState}
        initialLocale="zh-CN"
        initialLaunchContext={appMockLaunchContext as unknown as ChipsLaunchContext}
        initialSurface={appMockSurfaceContext as unknown as ChipsSurfaceContext}
        initialPermissions={client.state.permissions}
      >
        <ChipsThemeProvider
          themeId={defaultThemeState.themeId}
          version={defaultThemeState.version}
        >
          <AppRuntimeProvider>{children}</AppRuntimeProvider>
        </ChipsThemeProvider>
      </ChipsEnvironmentProvider>
    ),
  };
}
