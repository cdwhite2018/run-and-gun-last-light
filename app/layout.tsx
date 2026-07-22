import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Run & Gun: Last Light",
  description: "A fast side-scrolling shooter. Pick your operative and reach extraction.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
