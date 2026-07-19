import Link from "next/link";

const navigation = [
  { href: "/", label: "Atlas" },
  { href: "/materials", label: "Materials" },
  { href: "/coverage", label: "Coverage" },
  { href: "/methodology", label: "Methodology" },
  { href: "/releases", label: "Releases" },
  { href: "/contribute", label: "Contribute" },
];

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-frame">
      <header className="site-header">
        <div className="nav-shell">
          <Link
            className="wordmark"
            href="/"
            aria-label="CQD Photodiode Atlas home"
          >
            <span className="wordmark-mark" aria-hidden="true">
              D*
              <i />λ
            </span>
            <span>
              <strong>CQD</strong>
              <small>Photodiode Atlas</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Primary navigation">
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <a
            className="header-action"
            href="https://github.com/Shlok-Joseph-Paul/cQD-Detector-Compiler-and-Verifier"
            target="_blank"
            rel="noreferrer"
          >
            View data <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div>
          <p className="footer-title">CQD Photodiode Atlas</p>
          <p>
            A transparent, curator-reviewed map of reported colloidal
            quantum-dot photodiode performance.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/coverage">Dataset coverage</Link>
          <Link href="/methodology">Methodology</Link>
          <Link href="/releases">Dataset releases</Link>
          <Link href="/contribute">Suggest a record</Link>
          <a
            href="https://github.com/Shlok-Joseph-Paul/cQD-Detector-Compiler-and-Verifier"
            target="_blank"
            rel="noreferrer"
          >
            Source & data
          </a>
        </div>
        <p className="footer-note">
          Published values are reported as documented and are not independently
          reproduced by the atlas.
        </p>
      </footer>
    </div>
  );
}
