import { SiteShell } from "@/components/SiteShell";

export default function Loading() {
  return (
    <SiteShell>
      <div className="page-shell" role="status" aria-live="polite">
        <p>Loading page…</p>
      </div>
    </SiteShell>
  );
}
