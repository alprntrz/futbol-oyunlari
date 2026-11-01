import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";

import { APP_VERSION } from "./appHealth";

/**
 * Crash reports to Sentry (project tiktako/tiktako-app), errors only: no tracing, no replays, no
 * screenshots, no user. The privacy page promises crash reports carry no nickname, account or IP, so
 * `beforeSend` drops the user and request parts and console breadcrumbs (they may print nicks).
 * Off in development and when the build has no EXPO_PUBLIC_SENTRY_DSN (eas.json).
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";
export const SENTRY_ON = !__DEV__ && DSN.length > 0;

export function initSentry() {
  if (!SENTRY_ON) return;
  Sentry.init({
    dsn: DSN,
    release: `tiktako@${APP_VERSION}`,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    maxBreadcrumbs: 40,
    beforeBreadcrumb: (crumb) => (crumb.category === "console" ? null : crumb),
    beforeSend: (event) => {
      delete event.user;
      delete event.request;
      delete event.server_name;
      return event;
    },
  });
}

/** The root error screen (components/AppError.tsx) reports what it caught. */
export function captureCrash(error: Error, screen: string) {
  if (SENTRY_ON) Sentry.captureException(error, { tags: { screen } });
}

export const wrapRoot = <P extends Record<string, unknown>>(C: ComponentType<P>) =>
  SENTRY_ON ? Sentry.wrap(C) : C;
