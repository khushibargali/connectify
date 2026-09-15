import { useRef, useState } from 'react';
import { uploadsApi } from '../../api/uploads.api.js';
import { usersApi } from '../../api/users.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fieldErrors } from '../../lib/errors.js';
import { MAX_UPLOAD_MB } from '../../lib/media.js';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import Modal from '../common/Modal.jsx';
import TextField from '../common/TextField.jsx';

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ displayName: user.displayName, bio: user.bio || '', avatarUrl: user.avatarUrl || '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const pickPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image.');
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return setError(`Images must be under ${MAX_UPLOAD_MB} MB.`);
    setUploading(true);
    setError('');
    try {
      const stored = await uploadsApi.upload(file);
      setForm((f) => ({ ...f, avatarUrl: stored.url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
    return undefined;
  };

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
    <Modal title="Profile" onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="profile-preview">
          <button type="button" className="avatar-upload" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Change profile photo">
            <Avatar name={form.displayName} src={form.avatarUrl} size={96} />
            <span className="avatar-upload__badge">
              <Icon name="camera" size={16} />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="profile-preview__text">
            <strong>{form.displayName || user.displayName}</strong>
            <div className="muted">{user.phone}</div>
            <div className="muted">@{user.username}</div>
            <div className="profile-preview__actions">
              <button type="button" className="link" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : form.avatarUrl ? 'Change photo' : 'Add photo'}
              </button>
              {form.avatarUrl && (
                <button type="button" className="link link--danger" onClick={() => setForm((f) => ({ ...f, avatarUrl: '' }))}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <TextField label="Name" name="displayName" value={form.displayName} onChange={update} error={errors.displayName} maxLength={50} required />
        <TextField label="About" name="bio" as="textarea" rows={2} value={form.bio} onChange={update} error={errors.bio} maxLength={160} placeholder="Hey there! I am using Connectify." />
        {error && <p className="form__error" role="alert">{error}</p>}
        <div className="form__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={uploading}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
