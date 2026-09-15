import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { online, lastSeen, addMembers, leaveGroup } = useChat();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const members = participantUsers(conversation);
  const memberIds = members.map((m) => m.id);
  const amAdmin = isAdmin(conversation, user.id);
  const isGroup = conversation.type === 'group';

  const confirmAdd = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await addMembers(conversation.id, selected.map((u) => u.id));
      setSelected([]);
      setAdding(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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
        <Avatar name={conversationTitle(conversation, user.id)} group={isGroup} size={64} src={!isGroup ? members.find((m) => m.id !== user.id)?.avatarUrl : ''} />
        <div>
          <h3>{conversationTitle(conversation, user.id)}</h3>
          <p className="muted">{isGroup ? `${members.length} members` : `@${members.find((m) => m.id !== user.id)?.username || ''}`}</p>
        </div>
      </div>

      {!isGroup && members.find((m) => m.id !== user.id)?.bio && (
        <p className="info__bio">{members.find((m) => m.id !== user.id).bio}</p>
      )}

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
