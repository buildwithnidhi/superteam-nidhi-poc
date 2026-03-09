import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Superteam Events Dashboard",
  description: "View hosts and guests across Superteam Luma events",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
