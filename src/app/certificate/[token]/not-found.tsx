export default function CertificateNotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="kicker">Certificate</p>
      <h1 className="mt-5 font-display text-4xl">Certificate not found</h1>
      <p className="lede mt-4">
        This Certificate link is invalid. Use the Certificate on the message page, or prove ownership with your Wall Key on the claim page.
      </p>
    </main>
  );
}
