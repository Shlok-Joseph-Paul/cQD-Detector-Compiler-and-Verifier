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
      default: "Photodiode Atlas",
      template: "%s · Photodiode Atlas",
    },
    description:
      "A curated map of reported colloidal quantum-dot and metal-halide perovskite photodiode performance.",
    applicationName: "Photodiode Atlas",
    keywords: [
      "colloidal quantum dots",
      "photodiodes",
      "specific detectivity",
      "detector database",
      "CQD",
      "metal-halide perovskites",
      "perovskite photodiodes",
    ],
    authors: [{ name: "Photodiode Atlas contributors" }],
    openGraph: {
      title: "Photodiode Atlas",
      description:
        "Compare reported CQD and perovskite photodiode detectivity across materials, wavelengths, and noise methods.",
      type: "website",
      siteName: "Photodiode Atlas",
      images: [
        {
          url: new URL("/og.png", origin).toString(),
          width: 1200,
          height: 630,
          alt: "Photodiode Atlas detectivity versus wavelength data map",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Photodiode Atlas",
      description:
        "A curated map of reported CQD and perovskite photodiode performance.",
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
