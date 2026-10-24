import * as WebBrowser from "expo-web-browser";
import { Alert, Linking } from "react-native";

/** Public pages, served by GitHub Pages from the repo's site/ folder. */
const BASE = "https://alprntrz.github.io/futbol-oyunlari";
export const PRIVACY_URL = `${BASE}/privacy.html`;
export const SUPPORT_URL = `${BASE}/support.html`;

/**
 * Open one of our web pages inside the app (Safari View Controller / Custom Tab). Some phones refuse
 * `Linking.openURL` (it failed on App Review's device: Sentry TIKTAKO-APP-2), so that is only the fallback,
 * and if both fail the address is shown instead of nothing happening.
 */
export async function openPage(url: string, failText: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
    return;
  } catch {}
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(failText, url);
  }
}

/** The app's page in the phone's Settings; the caller's message already says where to go if it won't open. */
export function openAppSettings() {
  Linking.openSettings().catch(() => {});
}
