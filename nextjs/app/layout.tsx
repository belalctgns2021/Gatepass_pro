import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FactoryPass - Next.js Visitor Gate Pass System",
  description: "Production-ready factory visitor gate pass management system with QR verification and emergency muster list.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
