import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "CocoCorp Platform",
  description: "CocoCorp multi-tenant CRM, Marketing, and Content Engine",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

// Runs before React hydration to prevent flash of wrong theme/appearance
const themeScript = `(function(){try{
  var t=localStorage.getItem('theme');
  if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}
  var a=JSON.parse(localStorage.getItem('crm_accent')||'null');
  if(a&&a.color){var r=document.documentElement;r.style.setProperty('--accent',a.color);r.style.setProperty('--accent-hover',a.hover||a.color);r.style.setProperty('--sidebar-indicator',a.color);r.style.setProperty('--accent-glow',a.color+'30');r.style.setProperty('--accent-subtle',a.color+'14');r.style.setProperty('--sidebar-active',a.color+'20');}
  var rp=JSON.parse(localStorage.getItem('crm_radius')||'null');
  if(rp&&rp.vars){Object.entries(rp.vars).forEach(function(e){document.documentElement.style.setProperty(e[0],e[1]);});}
  var d=localStorage.getItem('crm_density');
  if(d){document.documentElement.setAttribute('data-density',d);}
  var g=localStorage.getItem('crm_glow');
  if(g==='false'){document.documentElement.style.setProperty('--accent-glow','transparent');document.documentElement.style.setProperty('--accent-subtle','transparent');}
}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
