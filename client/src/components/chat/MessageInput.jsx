import { useEffect, useRef, useState } from 'react';
import { ACCEPT_DOCS, ACCEPT_MEDIA, MAX_UPLOAD_MB, fileKind, formatBytes, formatDuration } from '../../lib/media.js';
import EmojiPicker from '../common/EmojiPicker.jsx';
import Icon from '../common/Icon.jsx';

const TYPING_RESEND_MS = 2000;
const TYPING_IDLE_MS = 2500;
const MAX_RECORDING_S = 300;

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return (
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'].find((m) =>
      MediaRecorder.isTypeSupported(m),
    ) || ''
  );
}

/**
 * WhatsApp-style composer: emoji picker, attachments (photos/videos/documents) with preview,
 * text with Enter-to-send, and voice notes recorded with MediaRecorder.
 */
export default function MessageInput({ onSend, onTyping, disabled = false }) {
  const [value, setValue] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [preview, setPreview] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState(null); // { seconds }

  const textareaRef = useRef(null);
  const mediaInputRef = useRef(null);
  const docInputRef = useRef(null);
  const typingRef = useRef({ lastSent: 0, idleTimer: null, active: false });
  const recorderRef = useRef(null);

  const canRecord =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  // ---- typing ----
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

  // ---- attachments ----
  const chooseFile = (file) => {
    setShowAttach(false);
    setError('');
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`That file is ${formatBytes(file.size)}; the limit is ${MAX_UPLOAD_MB} MB.`);
      return;
    }
    setAttachment(file);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (!attachment || !['image', 'video'].includes(fileKind(attachment))) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(attachment);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  // ---- send ----
  const submit = () => {
    const text = value.trim();
    if ((!text && !attachment) || disabled) return;
    onSend({ content: text, file: attachment });
    setValue('');
    setAttachment(null);
    setShowEmoji(false);
    stopTyping();
    requestAnimationFrame(() => {
      resize();
      textareaRef.current?.focus();
    });
  };

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + emoji + value.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
      resize();
    });
  };

  // ---- voice notes ----
  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      const startedAt = Date.now();
      let cancelled = false;
      let timer = null;
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timer);
        setRecording(null);
        recorderRef.current = null;
        if (cancelled || chunks.length === 0) return;
        const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm';
        const file = new File(chunks, `voice-note-${Date.now()}.${ext}`, { type });
        const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        onSend({ content: '', file, kind: 'audio', duration });
      };
      timer = setInterval(() => {
        const seconds = Math.round((Date.now() - startedAt) / 1000);
        setRecording({ seconds });
        if (seconds >= MAX_RECORDING_S) recorder.stop();
      }, 250);
      recorderRef.current = {
        recorder,
        cancel: () => {
          cancelled = true;
          recorder.stop();
        },
      };
      recorder.start(250);
      setRecording({ seconds: 0 });
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Microphone access was blocked.' : 'Could not start recording.');
    }
  };
  const finishRecording = () => recorderRef.current?.recorder.stop();
  const cancelRecording = () => recorderRef.current?.cancel();

  useEffect(() => {
    textareaRef.current?.focus();
    const typing = typingRef.current;
    return () => {
      clearTimeout(typing.idleTimer);
      recorderRef.current?.cancel();
    };
  }, []);

  const hasContent = Boolean(value.trim() || attachment);

  if (recording) {
    return (
      <div className="composer composer--recording" role="status">
        <button type="button" className="icon-btn composer__cancel" onClick={cancelRecording} aria-label="Cancel recording">
          <Icon name="trash" size={18} />
        </button>
        <span className="rec-dot" />
        <span className="composer__timer">{formatDuration(recording.seconds)}</span>
        <span className="muted composer__hint">Recording voice note…</span>
        <button type="button" className="composer__send" onClick={finishRecording} aria-label="Send voice note">
          <Icon name="send" size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="composer-wrap">
      {showEmoji && <EmojiPicker onPick={insertEmoji} />}

      {attachment && (
        <div className="attach-preview">
          {preview && fileKind(attachment) === 'image' && <img src={preview} alt="" />}
          {preview && fileKind(attachment) === 'video' && <video src={preview} muted />}
          {!preview && (
            <span className="attach-preview__icon">
              <Icon name={fileKind(attachment) === 'audio' ? 'mic' : 'file'} size={22} />
            </span>
          )}
          <span className="attach-preview__text">
            <strong>{attachment.name}</strong>
            <span className="muted">{formatBytes(attachment.size)} · add a caption below</span>
          </span>
          <button type="button" className="icon-btn" onClick={() => setAttachment(null)} aria-label="Remove attachment">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {error && <div className="composer__error">{error}</div>}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button
          type="button"
          className={`icon-btn ${showEmoji ? 'is-active' : ''}`}
          onClick={() => {
            setShowEmoji((v) => !v);
            setShowAttach(false);
          }}
          aria-label="Emoji"
          title="Emoji"
        >
          <Icon name="smile" size={22} />
        </button>

        <div className="attach">
          <button
            type="button"
            className={`icon-btn ${showAttach ? 'is-active' : ''}`}
            onClick={() => {
              setShowAttach((v) => !v);
              setShowEmoji(false);
            }}
            aria-label="Attach"
            title="Attach"
          >
            <Icon name="paperclip" size={22} />
          </button>
          {showAttach && (
            <div className="attach__menu" role="menu">
              <button type="button" role="menuitem" onClick={() => mediaInputRef.current?.click()}>
                <span className="attach__dot attach__dot--media">
                  <Icon name="image" size={16} />
                </span>
                Photos &amp; videos
              </button>
              <button type="button" role="menuitem" onClick={() => docInputRef.current?.click()}>
                <span className="attach__dot attach__dot--doc">
                  <Icon name="file" size={16} />
                </span>
                Document or audio
              </button>
            </div>
          )}
          <input
            ref={mediaInputRef}
            type="file"
            accept={ACCEPT_MEDIA}
            hidden
            onChange={(e) => {
              chooseFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <input
            ref={docInputRef}
            type="file"
            accept={ACCEPT_DOCS}
            hidden
            onChange={(e) => {
              chooseFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>

        <textarea
          ref={textareaRef}
          className="composer__input"
          placeholder={attachment ? 'Add a caption' : 'Type a message'}
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
          onFocus={() => setShowAttach(false)}
          onBlur={stopTyping}
          onPaste={(e) => {
            const file = [...(e.clipboardData?.files || [])][0];
            if (file) {
              e.preventDefault();
              chooseFile(file);
            }
          }}
          aria-label="Message"
        />

        {hasContent || !canRecord ? (
          <button type="submit" className="composer__send" disabled={disabled || !hasContent} aria-label="Send message">
            <Icon name="send" size={18} />
          </button>
        ) : (
          <button type="button" className="composer__send" onClick={startRecording} disabled={disabled} aria-label="Record voice note" title="Record voice note">
            <Icon name="mic" size={20} />
          </button>
        )}
      </form>
    </div>
  );
}
