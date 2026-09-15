import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import Button from '../components/common/Button.jsx';
import TextField from '../components/common/TextField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fieldErrors } from '../lib/errors.js';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', username: '', email: '', password: '' });
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
      await register({ ...form, displayName: form.displayName || undefined });
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
      subtitle="It only takes a few seconds"
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="form" noValidate>
        <TextField
          label="Display name"
          name="displayName"
          autoComplete="name"
          value={form.displayName}
          onChange={update}
          error={errors.displayName}
          placeholder="How others will see you"
          autoFocus
        />
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          value={form.username}
          onChange={update}
          error={errors.username}
          hint="Letters, numbers and underscores"
          required
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update}
          error={errors.email}
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update}
          error={errors.password}
          hint="At least 8 characters"
          required
        />
        {error && <p className="form__error" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="btn--block">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
