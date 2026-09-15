import { useEffect, useRef, useState } from 'react';
import Icon from '../common/Icon.jsx';

const TYPING_RESEND_MS = 2000;
const TYPING_IDLE_MS = 2500;

export default function MessageInput({ onSend, onTyping, disabled = false }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const typingRef = useRef({ lastSent: 0, idleTimer: null, active: false });

  const stopTyping = () => {
    const t = typingRef.current;
    clearTimeout(t.idleTimer);
    if (t.active) {
      t.active = false;
      onTyping(false);
    }
  };

  const noteTyping = () => {
    const t = typingRef.current;
    const now = Date.now();
    if (!t.active || now - t.lastSent > TYPING_RESEND_MS) {
      t.active = true;
      t.lastSent = now;
      onTyping(true);
    }
    clearTimeout(t.idleTimer);
    t.idleTimer = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    stopTyping();
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  };

  useEffect(() => {
    textareaRef.current?.focus();
    return () => clearTimeout(typingRef.current.idleTimer);
  }, []);

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={textareaRef}
        className="composer__input"
        placeholder="Type a message"
        rows={1}
        maxLength={4000}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setValue(e.target.value);
          resize();
          if (e.target.value.trim()) noteTyping();
          else stopTyping();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        onBlur={stopTyping}
        aria-label="Message"
      />
      <button type="submit" className="composer__send" disabled={disabled || !value.trim()} aria-label="Send message">
        <Icon name="send" size={18} />
      </button>
    </form>
  );
}
