export default function Spinner({ size = 20, className = '' }) {
  return <span className={`spinner ${className}`} style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}
