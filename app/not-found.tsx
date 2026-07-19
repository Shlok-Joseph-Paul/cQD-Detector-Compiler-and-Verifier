import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";

export default function NotFound() {
  return (
    <SiteShell>
      <section className="page-shell error-state">
        <p className="eyebrow">Record not found</p>
        <h1>This atlas entry does not exist.</h1>
        <p>
          It may have been renamed, removed during curation, or excluded by the
          project scope.
        </p>
        <Link className="primary-button" href="/">
          Return to the atlas
        </Link>
      </section>
    </SiteShell>
  );
}
