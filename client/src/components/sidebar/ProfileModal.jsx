import { useState } from 'react';
import { usersApi } from '../../api/users.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fieldErrors } from '../../lib/errors.js';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Modal from '../common/Modal.jsx';
import TextField from '../common/TextField.jsx';

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ displayName: user.displayName, bio: user.bio || '', avatarUrl: user.avatarUrl || '' });
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
      updateUser(await usersApi.updateProfile(form));
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err.details ? '' : err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="profile-preview">
          <Avatar name={form.displayName} src={form.avatarUrl} size={64} />
          <div>
            <strong>{form.displayName || user.displayName}</strong>
            <div className="muted">@{user.username}</div>
          </div>
        </div>
        <TextField label="Display name" name="displayName" value={form.displayName} onChange={update} error={errors.displayName} maxLength={50} required />
        <TextField label="Bio" name="bio" as="textarea" rows={2} value={form.bio} onChange={update} error={errors.bio} maxLength={160} placeholder="A few words about you" />
        <TextField label="Avatar URL" name="avatarUrl" type="url" value={form.avatarUrl} onChange={update} error={errors.avatarUrl} placeholder="https://…" />
        {error && <p className="form__error" role="alert">{error}</p>}
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
