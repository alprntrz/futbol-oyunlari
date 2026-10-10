import { createContext, useContext } from "react";

import { C } from "./theme";

/**
 * True while drawing straight onto a night (dark green) screen. Cards, buttons and
 * sheets reset it with <Light>, so text on white keeps its dark colours.
 */
const NightContext = createContext(false);

export const NightSurface = ({ children }: { children: React.ReactNode }) => <NightContext.Provider value>{children}</NightContext.Provider>;
export const Light = ({ children }: { children: React.ReactNode }) => <NightContext.Provider value={false}>{children}</NightContext.Provider>;
export const useNight = () => useContext(NightContext);

/** The light theme's ink colours, swapped for their on-dark versions. */
const ON_DARK: Record<string, string> = {
  [C.text]: "#FFFFFF",
  [C.text2]: "rgba(255,255,255,0.80)",
  [C.text3]: "rgba(255,255,255,0.64)",
  [C.greenMid]: "#86EFAC",
  [C.greenDark]: "#BBF7D0",
};
export const onDark = (color: string | undefined) => (color === undefined ? "#FFFFFF" : (ON_DARK[color] ?? color));
