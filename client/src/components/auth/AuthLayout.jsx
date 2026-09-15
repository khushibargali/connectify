export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="brand brand--lg">
          <span className="brand__logo" aria-hidden="true">
            ◎
          </span>
          Connectify
        </div>
        <h1>Message anyone, instantly.</h1>
        <p>
          Sign up with your phone number and chat one-to-one or in groups — with photos, videos, voice notes,
          documents, typing indicators and read receipts.
        </p>
        <ul className="auth__points">
          <li>Real-time delivery over WebSockets</li>
          <li>Photos, videos, voice notes and files</li>
          <li>Works on desktop and mobile</li>
        </ul>
      </aside>
      <main className="auth__panel">
        <div className="auth__card">
          <h2>{title}</h2>
          <p className="muted">{subtitle}</p>
          {children}
          <p className="auth__footer">{footer}</p>
        </div>
      </main>
    </div>
  );
}
