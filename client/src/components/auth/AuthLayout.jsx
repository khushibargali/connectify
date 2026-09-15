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
        <h1>Conversations that keep up with you.</h1>
        <p>
          Real-time messaging with presence, typing indicators and read receipts — built on React, Express,
          MongoDB and Socket.IO.
        </p>
        <ul className="auth__points">
          <li>Instant delivery over WebSockets</li>
          <li>Direct and group conversations</li>
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
