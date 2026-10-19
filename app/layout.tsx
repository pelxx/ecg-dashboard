import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MQTTProvider } from "@/components/realtime/MQTTProvider";
import { ThemeProvider } from "@/components/provider/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ECG Dashboard",
  description: "Real-time ECG Monitoring Dashboard",
  icons: {
    icon: '/logo.jpg', 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
return (
  <html lang="id" suppressHydrationWarning>
    <body
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <ThemeProvider>
        <MQTTProvider>
          {children}
        </MQTTProvider>
      </ThemeProvider>
    </body>
  </html>
);

}

