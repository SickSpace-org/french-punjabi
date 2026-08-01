import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.angrishfrancais.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "AngrishFrançais | Learn French. Prepare Smarter.",
  description:
    "Structured French learning and exam-focused TEF/TCF preparation with practical guidance, flexible classes, and personal attention.",
};

/**
 * Organization structured data — tells Google which image to show as this
 * site's logo in search results / the Knowledge Panel. See
 * https://developers.google.com/search/docs/appearance/structured-data/logo
 * The image itself lives at public/images/logo-flag.png; src/app/icon.png
 * and apple-icon.png (square crops of the same image) cover the browser
 * tab / mobile-search favicon separately.
 */
function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AngrishFrançais",
    url: siteUrl,
    logo: `${siteUrl}/images/logo-flag.png`,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full scroll-smooth antialiased`}
      suppressHydrationWarning
    >
      <head>
        <OrganizationJsonLd />
      </head>
      <body className="min-h-full flex flex-col bg-cream text-navy" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
