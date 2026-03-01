import type { Metadata } from "next";
import { Geist, Geist_Mono, Meow_Script } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fontMeowScript = Meow_Script({
  variable: "--font-meow-script",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "H5N1 Bóng Đá",
  description: "Trực tiếp bóng đá uy tín, tốc độ cao",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fontMeowScript.variable} antialiased min-h-screen bg-gradient-to-br from-bg-start to-bg-end text-foreground transition-colors duration-200`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
