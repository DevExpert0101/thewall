const GRADIENTS = [
  "from-ember to-flame",
  "from-flame to-rose-500",
  "from-gold to-ember",
  "from-amber-400 to-orange-600",
  "from-orange-500 to-red-600",
  "from-yellow-300 to-ember",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export default function VoiceAvatar({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  const h = hashStr(id);
  const gradient = GRADIENTS[h % GRADIENTS.length];
  const letter = (content.trim().charAt(0) || "?").toUpperCase();

  return (
    <div
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-display text-lg font-bold text-black shadow-[0_0_14px_rgba(255,122,26,0.35)] ring-1 ring-white/15`}
    >
      {letter}
    </div>
  );
}
