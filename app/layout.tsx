import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulseboard — Realtime Event Telemetry",
  description:
    "A live, event-driven observability dashboard streaming high-throughput telemetry over SSE with optional Kafka ingestion.",
};

export const viewport: Viewport = {
  themeColor: "#04060a",
  width: "device-width",
  initialScale: 1,
};

const themeScript = `(function(){try{var t=localStorage.getItem("pulseboard-theme");var l=t==="light";if(l){document.documentElement.classList.add("light");document.documentElement.style.colorScheme="light";}var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute("content",l?"#eef2f7":"#04060a");}}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
