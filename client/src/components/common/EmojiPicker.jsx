import { useState } from 'react';

const CATEGORIES = [
  { name: 'Smileys', emojis: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖' },
  { name: 'Gestures', emojis: '👍 👎 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 🤝 🙏 ✍️ 💪 🦾 🫶' },
  { name: 'Hearts', emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💞 💓 💗 💖 💘 💝 💟 ✨ ⭐ 🌟 💫 🔥 💯 ✅ ❌ ❗ ❓ 💤 🎉 🎊 🎈 🎁 🏆 🥇' },
  { name: 'Nature', emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦄 🐝 🦋 🌸 🌹 🌻 🌴 🌈 ☀️ 🌙 ⚡ ❄️ 🌊' },
  { name: 'Food', emojis: '🍎 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥑 🍔 🍟 🍕 🌮 🍣 🍜 🍩 🍪 🎂 🍫 🍿 ☕ 🍵 🧃 🍺 🥂' },
  { name: 'Objects', emojis: '📱 💻 ⌚ 📷 🎧 🎮 🚗 ✈️ 🚀 🏠 💡 📚 ✏️ 📌 📎 🔑 💰 💳 🛒 🎵 🎤 🎬 ⚽ 🏀 🏏 🎯' },
];

export default function EmojiPicker({ onPick }) {
  const [active, setActive] = useState(0);
  return (
    <div className="emoji" role="dialog" aria-label="Emoji picker">
      <div className="emoji__tabs" role="tablist">
        {CATEGORIES.map((c, i) => (
          <button type="button" key={c.name} role="tab" aria-selected={i === active} className={i === active ? 'is-active' : ''} onClick={() => setActive(i)}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="emoji__grid">
        {CATEGORIES[active].emojis.split(' ').map((e) => (
          <button type="button" key={e} className="emoji__item" onClick={() => onPick(e)} aria-label={e}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
