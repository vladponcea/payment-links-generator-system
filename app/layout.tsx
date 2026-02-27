import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-orbitron",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "CloserPay — Payment Link Generator & Sales Analytics",
  description:
    "Generate custom Whop checkout links and track sales performance in real-time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} font-[family-name:var(--font-inter)] antialiased bg-cyber-black text-cyber-text`}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#12121A",
              color: "#E0E0E0",
              border: "1px solid #2A2A3E",
              fontFamily: "Inter, sans-serif",
            },
            success: {
              iconTheme: {
                primary: "#00FF88",
                secondary: "#12121A",
              },
            },
            error: {
              iconTheme: {
                primary: "#FF3366",
                secondary: "#12121A",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
