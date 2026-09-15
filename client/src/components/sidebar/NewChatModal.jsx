import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../../context/ChatContext.jsx';
import Button from '../common/Button.jsx';
import Modal from '../common/Modal.jsx';
import TextField from '../common/TextField.jsx';
import UserPicker from '../common/UserPicker.jsx';

export default function NewChatModal({ onClose }) {
  const { startDirect, createGroup, online } = useChat();
  const navigate = useNavigate();
  const [tab, setTab] = useState('direct');
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = (conversation) => {
    navigate(`/c/${conversation.id}`);
    onClose();
  };

  const pickDirect = async (user) => {
    setBusy(true);
    setError('');
    try {
      open(await startDirect(user.id));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const submitGroup = async (e) => {
    e.preventDefault();
    if (!name.trim() || members.length === 0) {
      setError('Give the group a name and pick at least one member.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      open(await createGroup({ name: name.trim(), memberIds: members.map((u) => u.id) }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title="New conversation" onClose={onClose}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'direct'} className={tab === 'direct' ? 'is-active' : ''} onClick={() => setTab('direct')}>
          Direct message
        </button>
        <button type="button" role="tab" aria-selected={tab === 'group'} className={tab === 'group' ? 'is-active' : ''} onClick={() => setTab('group')}>
          Group
        </button>
      </div>

      {error && <p className="form__error" role="alert">{error}</p>}

      {tab === 'direct' ? (
        <div className={busy ? 'is-busy' : ''}>
          <UserPicker onPick={pickDirect} online={online} />
        </div>
      ) : (
        <form onSubmit={submitGroup} className="form">
          <TextField label="Group name" name="groupName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend plans" maxLength={80} />
          <UserPicker multi selected={members} onChange={setMembers} online={online} />
          <Button type="submit" loading={busy} className="btn--block">
            Create group{members.length ? ` (${members.length + 1} members)` : ''}
          </Button>
        </form>
      )}
    </Modal>
  );
}
