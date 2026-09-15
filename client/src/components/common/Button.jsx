import Spinner from './Spinner.jsx';

export default function Button({ variant = 'primary', size = 'md', loading = false, className = '', children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={loading || props.disabled}
    >
      {loading && <Spinner size={14} className="btn__spinner" />}
      <span>{children}</span>
    </button>
  );
}
