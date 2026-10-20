export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M6 39h36l-4.5-8h-27z" />
            <path d="M13.5 31h21l-3.5-7.5h-14z" />
            <path d="M19 23.5h10L26.5 16h-5z" />
          </svg>
          <span>Cairn</span>
        </div>
        <p className="footer-blurb">
          An open-source evidence desk. It reports what readable sources say — with the passage that decided each
          reading — and does not claim to settle the truth.
        </p>
      </div>
      <div className="footer-bottom">
        <span>MIT licensed · Built for Build With AI: Basics · 2026</span>
        <span>No accounts · No analytics · No cookies</span>
      </div>
    </footer>
  );
}
