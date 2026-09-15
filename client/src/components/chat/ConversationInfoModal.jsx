import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadsApi } from '../../api/uploads.api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import { conversationTitle, isAdmin, participantUsers } from '../../lib/conversation.js';
import { formatLastSeen } from '../../lib/format.js';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import Modal from '../common/Modal.jsx';
import UserPicker from '../common/UserPicker.jsx';

export default function ConversationInfoModal({ conversation, onClose }) {
  const { user } = useAuth();
  const { online, lastSeen, addMembers, leaveGroup, updateGroup, removeMember, setMuted } = useChat();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState([]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(conversation.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef(null);

  const members = participantUsers(conversation);
  const memberIds = members.map((m) => m.id);
  const amAdmin = isAdmin(conversation, user.id);
  const isGroup = conversation.type === 'group';
  const other = members.find((m) => m.id !== user.id);
  const me = conversation.participants.find((p) => p.user?.id === user.id);
  const title = conversationTitle(conversation, user.id);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmAdd = () =>
    selected.length > 0 &&
    run(async () => {
      await addMembers(conversation.id, selected.map((u) => u.id));
      setSelected([]);
      setAdding(false);
    });

  const saveName = (e) => {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === conversation.name) return setRenaming(false);
    return run(async () => {
      await updateGroup(conversation.id, { name: next });
      setRenaming(false);
    });
  };

  const changePhoto = (file) => {
    if (!file) return;
    run(async () => {
      const stored = await uploadsApi.upload(file);
      await updateGroup(conversation.id, { avatarUrl: stored.url });
    });
  };

  const confirmRemove = (member) => {
    if (!window.confirm(`Remove ${member.displayName} from "${conversation.name}"?`)) return;
    run(() => removeMember(conversation.id, member.id));
  };

  const confirmLeave = async () => {
    if (!window.confirm(`Leave "${conversation.name}"? You will stop receiving its messages.`)) return;
    setBusy(true);
    try {
      await leaveGroup(conversation.id);
      onClose();
      navigate('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={isGroup ? 'Group details' : 'Contact details'} onClose={onClose}>
      <div className="info__head">
        {isGroup && amAdmin ? (
          <button type="button" className="avatar-upload" onClick={() => photoRef.current?.click()} disabled={busy} aria-label="Change group photo">
            <Avatar name={title} group size={64} src={conversation.avatarUrl} />
            <span className="avatar-upload__badge">
              <Icon name="camera" size={14} />
            </span>
          </button>
        ) : (
          <Avatar name={title} group={isGroup} size={64} src={isGroup ? conversation.avatarUrl : other?.avatarUrl} />
        )}
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { changePhoto(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="info__head-text">
          {renaming ? (
            <form className="info__rename" onSubmit={saveName}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus aria-label="Group name" />
              <Button type="submit" size="sm" loading={busy}>
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <h3>
              {title}
              {isGroup && amAdmin && (
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setRenaming(true)} aria-label="Rename group" title="Rename">
                  <Icon name="edit-2" size={14} />
                </button>
              )}
            </h3>
          )}
          <p className="muted">{isGroup ? `${members.length} members` : `${other?.phone || ''}${other?.username ? ` · @${other.username}` : ''}`}</p>
        </div>
      </div>

      {!isGroup && other?.bio && <p className="info__bio">{other.bio}</p>}

      <label className="switch-row">
        <span>
          <Icon name="bell-off" size={16} /> Mute notifications
        </span>
        <input type="checkbox" checked={Boolean(me?.muted)} disabled={busy} onChange={(e) => run(() => setMuted(conversation.id, e.target.checked))} />
        <span className="switch" aria-hidden="true" />
      </label>

      {error && <p className="form__error" role="alert">{error}</p>}

      {adding ? (
        <div className="form">
          <UserPicker multi selected={selected} onChange={setSelected} exclude={memberIds} online={online} />
          <div className="form__actions">
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAdd} loading={busy} disabled={selected.length === 0}>
              Add {selected.length || ''}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="info__section-title">
            <span>Members</span>
            {isGroup && amAdmin && (
              <button type="button" className="link" onClick={() => setAdding(true)}>
                <Icon name="plus" size={14} /> Add people
              </button>
            )}
          </div>
          <ul className="member-list">
            {members.map((m) => (
              <li key={m.id} className="member">
                <Avatar name={m.displayName} src={m.avatarUrl} size={36} online={Boolean(online[m.id])} />
                <span className="member__text">
                  <span className="member__name">
                    {m.displayName}
                    {m.id === user.id && <span className="muted"> (you)</span>}
                  </span>
                  <span className="muted">{m.phone ? `${m.phone} · ` : ''}{online[m.id] ? 'Online' : formatLastSeen(lastSeen[m.id] || m.lastSeenAt)}</span>
                </span>
                {isAdmin(conversation, m.id) && <span className="tag">Admin</span>}
                {isGroup && amAdmin && m.id !== user.id && (
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => confirmRemove(m)} disabled={busy} aria-label={`Remove ${m.displayName}`} title="Remove from group">
                    <Icon name="user-minus" size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isGroup && (
            <div className="form__actions">
              <Button variant="danger" onClick={confirmLeave} loading={busy}>
                Leave group
              </Button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
