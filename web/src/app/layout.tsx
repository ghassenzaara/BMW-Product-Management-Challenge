import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { Intro, introBootScript } from "@/components/brand/intro";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Argon",
  description: "Signals → Cases → Requirements for the next vehicle generation (hackathon demo, synthetic data).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background">
        {/* Decides before the first paint whether the headlight intro plays (first visit only). */}
        <script dangerouslySetInnerHTML={{ __html: introBootScript }} />
        <Intro />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
