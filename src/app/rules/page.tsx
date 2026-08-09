import Link from "next/link";
import BackNav from "@/components/BackNav";

export const metadata = {
  title: "The Wall Rules",
};

const RULES = [
  {
    title: "One message per Wall",
    body: "You get one chance to be heard. Choose your words like they matter — they do.",
  },
  {
    title: "140 characters or fewer",
    body: "Brevity is the soul of the Wall. Make every character earn its place.",
  },
  {
    title: "Say something real",
    body: "No hate, no harassment, no spam, no doxxing, no threats. You are anonymous — so be honest, not cruel.",
  },
  {
    title: "It costs $1",
    body: "A dollar buys you a stone in the Wall. This keeps the voices human and the noise out.",
  },
  {
    title: "Your voice is permanent",
    body: "Once etched, a message can never be edited. When a Wall seals, it becomes a permanent record.",
  },
  {
    title: "Every voice is checked",
    body: "Automatic moderation screens every message for spam, personal information, profanity, threats, and abuse before it can go live — and anyone can report a voice for review.",
  },
  {
    title: "Don't break the Wall",
    body: "Abuse the payment system or the rules, and your voice is struck from the record by a moderator. The number stays; the voice goes.",
  },
];

export default function RulesPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-14">
      <BackNav />
      <header className="text-center">
        <p className="text-[10px] uppercase tracking-[0.4em] text-muted">
          Before you etch
        </p>
        <h1 className="font-display text-5xl sm:text-6xl">The Wall rules</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          One dollar. One message. Forever. A few rules keep the Wall honest.
        </p>
      </header>

      <ol className="flex flex-col gap-4">
        {RULES.map((r, i) => (
          <li
            key={r.title}
            className="flex items-start gap-5 rounded-2xl border border-edge bg-card/40 p-6"
          >
            <span className="font-display w-10 shrink-0 pt-0.5 text-center text-3xl text-ember">
              {i + 1}
            </span>
            <div>
              <h2 className="font-display text-xl italic text-cream">{r.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex justify-center">
        <Link
          href="/submit"
          className="rounded-full bg-gradient-to-r from-flame to-ember px-8 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 glow-ember"
        >
          Agree & etch your message
        </Link>
      </div>
    </main>
  );
}
