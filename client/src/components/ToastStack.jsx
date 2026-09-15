import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext.jsx';
import Icon from './common/Icon.jsx';

export default function ToastStack() {
  const { toasts, dismissToast } = useChat();
  const navigate = useNavigate();

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timer = setTimeout(() => dismissToast(toasts[0].id), 5000);
    return () => clearTimeout(timer);
  }, [toasts, dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <button
            type="button"
            className="toast__body"
            onClick={() => {
              navigate(`/c/${toast.conversationId}`);
              dismissToast(toast.id);
            }}
          >
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </button>
          <button type="button" className="icon-btn toast__close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
            <Icon name="x" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
