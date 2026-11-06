import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { site } from "../lib/site";

export const metadata: Metadata = {
  title: site.name,
  description: `Secure election administration and voting for ${site.university}.`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="university-banner">
          <div className="shell">
            <Link className="university-brand" href="/">
              <Image
                src="/images/oau-crest.png"
                alt="Obafemi Awolowo University crest"
                width={40}
                height={40}
                priority
              />
              <span>Obafemi Awolowo University</span>
              <strong>eVoting System</strong>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
