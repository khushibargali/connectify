import { useState } from 'react';
import { initials } from '../../lib/format.js';
import Icon from './Icon.jsx';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];

function colorFor(seed = '') {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function Avatar({ name = '', src = '', size = 40, online, group = false, className = '' }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };

  return (
    <span className={`avatar ${className}`} style={style}>
      {showImage ? (
        <img src={src} alt={name} onError={() => setFailed(true)} />
      ) : group ? (
        <span className="avatar__fallback avatar__fallback--group">
          <Icon name="users" size={Math.round(size * 0.5)} />
        </span>
      ) : (
        <span className="avatar__fallback" style={{ background: colorFor(name) }}>
          {initials(name)}
        </span>
      )}
      {online !== undefined && <span className={`avatar__dot ${online ? 'is-online' : ''}`} title={online ? 'Online' : 'Offline'} />}
    </span>
  );
}
