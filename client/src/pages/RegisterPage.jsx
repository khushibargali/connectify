import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import TextField from '../components/common/TextField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors } from '../lib/errors.js';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, composePhone } from '../lib/phone.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', countryCode: DEFAULT_COUNTRY_CODE, number: '', password: '', username: '', email: '' });
  const [showOptional, setShowOptional] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      await register({
        displayName: form.displayName,
        phone: composePhone(form.countryCode, form.number),
        password: form.password,
        username: form.username || undefined,
        email: form.email || undefined,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err.details ? '' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Sign up with your phone number, like WhatsApp"
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="form" noValidate>
        <TextField label="Your name" name="displayName" autoComplete="name" value={form.displayName} onChange={update} error={errors.displayName} placeholder="How others will see you" autoFocus required />

        <div className={`field ${errors.phone ? 'field--error' : ''}`}>
          <label htmlFor="number">Phone number</label>
          <div className="phone-input">
            <select name="countryCode" value={form.countryCode} onChange={update} aria-label="Country code">
              {COUNTRY_CODES.map((c) => (
                <option key={c.code + c.name} value={c.code}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
            <input id="number" name="number" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="98765 43210" value={form.number} onChange={update} required />
          </div>
          {errors.phone ? <span className="field__error">{errors.phone}</span> : <span className="field__hint">People can find you by this number</span>}
        </div>

        <TextField label="Password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={update} error={errors.password} hint="At least 8 characters" required />

        <button type="button" className="link form__toggle" onClick={() => setShowOptional((v) => !v)}>
          {showOptional ? 'Hide' : 'Add'} username &amp; email (optional)
        </button>
        {showOptional && (
          <>
            <TextField label="Username" name="username" autoComplete="username" value={form.username} onChange={update} error={errors.username} hint="Letters, numbers and underscores — generated from your name if left blank" />
            <TextField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} error={errors.email} />
          </>
        )}

        {error && <p className="form__error" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="btn--block">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
