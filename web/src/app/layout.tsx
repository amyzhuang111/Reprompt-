import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "AEO Intelligence — See why they win. Fix yours.",
  description:
    "Reverse-engineer why ChatGPT recommends your competitor. Optimize social posts for AI citation. Test if your queries trigger product recommendations. Built on published AEO research.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
