import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../../api/users.api.js';
import { useChat } from '../../context/ChatContext.jsx';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, composePhone } from '../../lib/phone.js';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';
import Modal from '../common/Modal.jsx';
import TextField from '../common/TextField.jsx';
import UserPicker from '../common/UserPicker.jsx';

export default function NewChatModal({ onClose }) {
  const { startDirect, createGroup, online } = useChat();
  const navigate = useNavigate();
  const [tab, setTab] = useState('direct');
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [number, setNumber] = useState('');
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

  const startByPhone = async (e) => {
    e.preventDefault();
    const phone = composePhone(countryCode, number);
    if (!phone) return setError('Enter a phone number.');
    setBusy(true);
    setError('');
    try {
      const user = await usersApi.lookupPhone(phone);
      open(await startDirect(user.id));
    } catch (err) {
      setError(err.status === 404 ? `${phone} is not on Connectify yet. Ask them to sign up!` : err.message);
      setBusy(false);
    }
    return undefined;
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
    <Modal title="New chat" onClose={onClose}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'direct'} className={tab === 'direct' ? 'is-active' : ''} onClick={() => setTab('direct')}>
          Direct message
        </button>
        <button type="button" role="tab" aria-selected={tab === 'group'} className={tab === 'group' ? 'is-active' : ''} onClick={() => setTab('group')}>
          New group
        </button>
      </div>

      {error && <p className="form__error" role="alert">{error}</p>}

      {tab === 'direct' ? (
        <div className={`form ${busy ? 'is-busy' : ''}`}>
          <form className="phone-start" onSubmit={startByPhone}>
            <label className="field__label-row">
              <Icon name="phone" size={14} /> Start a chat by phone number
            </label>
            <div className="phone-input">
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} aria-label="Country code">
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code + c.name} value={c.code}>
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
              <input type="tel" inputMode="tel" placeholder="Phone number" value={number} onChange={(e) => setNumber(e.target.value)} aria-label="Phone number" />
              <Button type="submit" size="sm" loading={busy} disabled={!number.trim()}>
                Chat
              </Button>
            </div>
          </form>
          <div className="divider">
            <span>or pick someone on Connectify</span>
          </div>
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
