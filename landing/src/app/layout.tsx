import type { Metadata } from "next";
import { Inclusive_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Inclusive_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OnboardOS · The AI business launch orchestrator",
  description: "OnboardOS helps enterprise platforms onboard new businesses in weeks, not months. Finance, document and compliance agents take each business from requirements to launch-ready accounting; you approve every document.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${code.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
