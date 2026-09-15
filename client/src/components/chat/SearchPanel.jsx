import { useEffect, useState } from 'react';
import { formatConversationTime } from '../../lib/format.js';
import { messageSummary } from '../../lib/media.js';
import Icon from '../common/Icon.jsx';
import Spinner from '../common/Spinner.jsx';

/** In-conversation search: results come from the API, clicking one jumps to the message. */
export default function SearchPanel({ onSearch, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setError('');
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      onSearch(q)
        .then((messages) => active && setResults(messages))
        .catch((err) => active && setError(err.message))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, onSearch]);

  return (
    <div className="search-panel">
      <div className="search-panel__bar">
        <div className="search search--grow">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Search in this chat"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            autoFocus
            aria-label="Search messages"
          />
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close search">
          <Icon name="x" />
        </button>
      </div>
      {loading && (
        <div className="search-panel__state">
          <Spinner size={16} />
        </div>
      )}
      {error && <div className="search-panel__state search-panel__state--error">{error}</div>}
      {results && !loading && results.length === 0 && <div className="search-panel__state muted">No messages found.</div>}
      {results && results.length > 0 && (
        <ul className="search-results">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" className="search-result" onClick={() => onPick(m)}>
                <span className="search-result__head">
                  <strong>{m.sender?.displayName}</strong>
                  <time className="muted">{formatConversationTime(m.createdAt)}</time>
                </span>
                <span className="search-result__text">{messageSummary(m)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
