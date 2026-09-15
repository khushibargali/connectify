import { typingLabel } from '../../lib/conversation.js';

export default function TypingIndicator({ users }) {
  if (!users || users.length === 0) return null;
  return (
    <div className="typing" aria-live="polite">
      <span className="typing__dots">
        <i />
        <i />
        <i />
      </span>
      <span className="typing-text">{typingLabel(users)}</span>
    </div>
  );
}
