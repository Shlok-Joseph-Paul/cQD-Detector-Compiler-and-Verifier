import Link from "next/link";
import type { ComponentProps } from "react";

const prefetchedPages = new Set([
  "/coverage",
  "/discovery",
  "/methodology",
  "/releases",
  "/contribute",
]);

/** Prefetch the small navigation pages without downloading every atlas record. */
export default function SiteLink({ href, ...props }: ComponentProps<"a">) {
  if (
    !href ||
    !href.startsWith("/") ||
    href.startsWith("//") ||
    props.download
  ) {
    return <a href={href} {...props} />;
  }
  return <Link href={href} prefetch={prefetchedPages.has(href)} {...props} />;
}
