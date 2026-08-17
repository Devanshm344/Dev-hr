"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import "next-themes/dist/types";
export function ThemeProvider({
  children,
  ...props
}) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
