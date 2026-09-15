import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotificationPermission } from '../../hooks/useNotificationPermission.js';
import Avatar from '../common/Avatar.jsx';
import Icon from '../common/Icon.jsx';

export default function UserMenu({ onProfile }) {
  const { user, logout } = useAuth();
  const { supported, permission, request } = useNotificationPermission();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const notificationLabel =
    permission === 'granted' ? 'Desktop notifications on' : permission === 'denied' ? 'Notifications blocked' : 'Enable notifications';

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="menu__trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar name={user.displayName} src={user.avatarUrl} size={34} online />
      </button>
      {open && (
        <div className="menu__panel" role="menu">
          <div className="menu__identity">
            <strong>{user.displayName}</strong>
            <span className="muted">{user.phone}</span>
            <span className="muted">@{user.username}</span>
          </div>
          <button type="button" role="menuitem" className="menu__item" onClick={() => { setOpen(false); onProfile(); }}>
            <Icon name="edit" size={16} /> Edit profile
          </button>
          {supported && (
            <button
              type="button"
              role="menuitem"
              className="menu__item"
              disabled={permission !== 'default'}
              onClick={() => { request(); setOpen(false); }}
            >
              <Icon name="bell" size={16} /> {notificationLabel}
            </button>
          )}
          <button type="button" role="menuitem" className="menu__item menu__item--danger" onClick={logout}>
            <Icon name="log-out" size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
