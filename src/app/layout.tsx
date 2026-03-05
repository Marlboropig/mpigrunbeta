import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MPIG RUN 🐷 | The Ultimate Solana Degame",
  description: "Dodge the red candles, stack $MPIG, and reach for the moon in this hyper-addictive Solana flyer!",
  openGraph: {
    title: "MPIG RUN 🐷 | Can you beat my score?",
    description: "The most addictive crypto game on Solana. Play now!",
    url: "https://mpigg.xyz",
    siteName: "MPIG RUN",
    images: [
      {
        url: "/assets/x-post.png",
        width: 1200,
        height: 630,
        alt: "MPIG RUN Game Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MPIG RUN 🐷 | Score: [SCORE]",
    description: "I'm crushing the candles! Can you beat me?",
    images: ["/assets/x-post.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} ${sora.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
