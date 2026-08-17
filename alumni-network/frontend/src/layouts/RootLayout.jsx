import { Outlet } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
export function RootLayout() {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <Outlet />
      <Toaster position="top-right" richColors />
    </ThemeProvider>;
}
