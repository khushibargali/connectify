import Icon from '../common/Icon.jsx';

export default function EmptyState() {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name="message" size={36} />
      </div>
      <h2>Your messages</h2>
      <p className="muted">Pick a conversation on the left, or start a new one with the + button.</p>
    </div>
  );
}
