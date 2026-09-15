import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import EmptyState from '../components/chat/EmptyState.jsx';
import Sidebar from '../components/sidebar/Sidebar.jsx';
import ToastStack from '../components/ToastStack.jsx';
import { useChat } from '../context/ChatContext.jsx';

export default function ChatPage() {
  const { conversationId = null } = useParams();
  const { openConversation } = useChat();

  useEffect(() => {
    openConversation(conversationId);
    return () => openConversation(null);
  }, [conversationId, openConversation]);

  return (
    <div className={`shell ${conversationId ? 'shell--conversation' : ''}`}>
      <Sidebar activeId={conversationId} />
      <main className="chat">
        {conversationId ? <ChatWindow key={conversationId} conversationId={conversationId} /> : <EmptyState />}
      </main>
      <ToastStack />
    </div>
  );
}
