import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "CQD Photodiode Atlas",
      template: "%s · CQD Photodiode Atlas",
    },
    description:
      "A curated map of reported colloidal quantum-dot photodiode performance across materials and wavelengths.",
    applicationName: "CQD Photodiode Atlas",
    keywords: [
      "colloidal quantum dots",
      "photodiodes",
      "specific detectivity",
      "detector database",
      "CQD",
    ],
    authors: [{ name: "CQD Photodiode Atlas contributors" }],
    openGraph: {
      title: "CQD Photodiode Atlas",
      description:
        "Compare reported CQD photodiode detectivity across materials, wavelengths, and noise methods.",
      type: "website",
      siteName: "CQD Photodiode Atlas",
      images: [
        {
          url: new URL("/og.png", origin).toString(),
          width: 1200,
          height: 630,
          alt: "CQD Photodiode Atlas detectivity versus wavelength data map",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "CQD Photodiode Atlas",
      description:
        "A curated map of reported colloidal quantum-dot photodiode performance.",
      images: [new URL("/og.png", origin).toString()],
    },
    icons: {
      icon: "/favicon.png",
      shortcut: "/favicon.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
