import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/dancing-script/wght.css";
import "@fontsource-variable/inter/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ahmed Rammah — Engineer · Systematizer · Trainer · Coach",
  description:
    "I map your psychological system, find the bugs, and rewrite the code.",
};

import FloatingCTA from "@/components/FloatingCTA";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <FloatingCTA />
      </body>
    </html>
  );
}
