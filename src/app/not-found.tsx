import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center sm:py-32">
      <p className="kicker">404</p>
      <h1 className="mt-5 font-display text-[clamp(2.6rem,9vw,4.4rem)] leading-[0.9]">This stone is blank.</h1>
      <p className="lede mt-5">The path does not exist on The Wall.</p>
      <Link href="/" className="btn-ghost mt-10 inline-flex kicker hover:text-paper">
        Return home →
      </Link>
    </main>
  );
}
