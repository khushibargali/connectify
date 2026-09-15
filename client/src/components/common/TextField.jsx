export default function TextField({ label, error, hint, id, as: Tag = 'input', className = '', ...props }) {
  const inputId = id || props.name;
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <Tag id={inputId} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}
