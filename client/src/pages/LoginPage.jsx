import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import TextField from '../components/common/TextField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors } from '../lib/errors.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
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
      await login(form);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err.details ? '' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to Connectify"
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} className="form" noValidate>
        <TextField
          label="Username or email"
          name="identifier"
          autoComplete="username"
          value={form.identifier}
          onChange={update}
          error={errors.identifier}
          autoFocus
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update}
          error={errors.password}
          required
        />
        {error && <p className="form__error" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="btn--block">
          Sign in
        </Button>
        <p className="form__hint">Demo (when seeded): <code>alice</code> / <code>password123</code></p>
      </form>
    </AuthLayout>
  );
}
