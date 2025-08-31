import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { PublicNavbar } from "~/components/public-navbar";

export const metadata: Metadata = {
  title: "Green Trade",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} `}>
      <SessionProvider>
        <body className="">
          <PublicNavbar />
          {children}
        </body>
      </SessionProvider>
    </html>
  );
}
