export function DemoBanner() {
  return (
    <aside className="demo-banner" aria-label="Demonstration data notice">
      <span className="demo-icon" aria-hidden="true">
        i
      </span>
      <p>
        <strong>Demonstration dataset.</strong> Every record in this first build
        is synthetic and is not a literature record. Replace the editable CSV
        rows with curator-verified publications before scientific use.
      </p>
    </aside>
  );
}
