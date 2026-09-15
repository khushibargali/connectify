import { useEffect, useState } from 'react';
import { usersApi } from '../../api/users.api.js';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';
import Spinner from './Spinner.jsx';

/**
 * Searchable user list. In single mode clicking a user calls onPick(user);
 * in multi mode it toggles selection and calls onChange(selectedUsers).
 */
export default function UserPicker({ multi = false, selected = [], onPick, onChange, exclude = [], online = {} }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      usersApi
        .search(query)
        .then((users) => active && setResults(users))
        .catch((err) => active && setError(err.message))
        .finally(() => active && setLoading(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const excluded = new Set(exclude);
  const selectedIds = new Set(selected.map((u) => u.id));
  const visible = results.filter((u) => !excluded.has(u.id));

  const toggle = (user) => {
    if (!multi) return onPick?.(user);
    const next = selectedIds.has(user.id) ? selected.filter((u) => u.id !== user.id) : [...selected, user];
    return onChange?.(next);
  };

  return (
    <div className="picker">
      <div className="search">
        <Icon name="search" size={16} />
        <input
          type="search"
          placeholder="Search people by name or username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {multi && selected.length > 0 && (
        <div className="chips">
          {selected.map((u) => (
            <button type="button" key={u.id} className="chip" onClick={() => toggle(u)}>
              {u.displayName} <Icon name="x" size={12} />
            </button>
          ))}
        </div>
      )}

      <ul className="picker__list">
        {loading && results.length === 0 && (
          <li className="picker__state">
            <Spinner />
          </li>
        )}
        {error && <li className="picker__state picker__state--error">{error}</li>}
        {!loading && !error && visible.length === 0 && <li className="picker__state">No people found.</li>}
        {visible.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className={`picker__item ${selectedIds.has(u.id) ? 'is-selected' : ''}`}
              onClick={() => toggle(u)}
            >
              <Avatar name={u.displayName} src={u.avatarUrl} size={36} online={Boolean(online[u.id])} />
              <span className="picker__text">
                <span className="picker__name">{u.displayName}</span>
                <span className="muted">@{u.username}{u.phone ? ` · ${u.phone}` : ''}</span>
              </span>
              {multi && selectedIds.has(u.id) && <Icon name="check" size={18} className="picker__check" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
