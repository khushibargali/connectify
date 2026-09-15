import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../context/ChatContext.jsx';
import Button from '../common/Button.jsx';
import Spinner from '../common/Spinner.jsx';
import ConversationItem from './ConversationItem.jsx';

export default function ConversationList({ conversations, activeId, loaded, filtering, onNew }) {
  const { user } = useAuth();
  const { online, typing } = useChat();

  if (!loaded) {
    return (
      <div className="list-state">
        <Spinner />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="list-state">
        <p className="muted">{filtering ? 'No conversations match your search.' : 'No conversations yet.'}</p>
        {!filtering && (
          <Button variant="secondary" size="sm" onClick={onNew}>
            Start a chat
          </Button>
        )}
      </div>
    );
  }

  return (
    <ul className="conv-list">
      {conversations.map((c) => (
        <ConversationItem
          key={c.id}
          conversation={c}
          active={c.id === activeId}
          meId={user.id}
          online={online}
          typing={typing[c.id]}
        />
      ))}
    </ul>
  );
}
