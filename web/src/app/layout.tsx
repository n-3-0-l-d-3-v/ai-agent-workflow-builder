import type { Metadata } from "next";
import { Urbanist, Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthProvider";
import { OrgProvider } from "@/context/OrgProvider";
import { Nav } from "@/components/Nav";

const urbanist = Urbanist({
  variable: "--font-body",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dispatch",
  description: "Org-scoped, role-gated AI agent workflow orchestration.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${urbanist.variable} ${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <OrgProvider>
            <Nav />
            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
          </OrgProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
