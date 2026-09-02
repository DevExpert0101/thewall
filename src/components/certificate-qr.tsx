import {
  CERTIFICATE_QR_GROUND,
  CERTIFICATE_QR_MARK,
  certificateQrPath,
  encodeCertificateQr,
} from "@/lib/certificate/qr";

export function CertificateQr({
  publicNumber,
  origin,
  size = 104,
}: {
  publicNumber: number;
  origin?: string;
  size?: number;
}) {
  const qr = encodeCertificateQr(publicNumber, origin);
  return (
    <figure className="certificate-qr">
      <svg
        role="img"
        aria-label={`QR code for the public certificate of message ${publicNumber}`}
        viewBox={`0 0 ${qr.viewBox} ${qr.viewBox}`}
        width={size}
        height={size}
        shapeRendering="crispEdges"
      >
        <rect width={qr.viewBox} height={qr.viewBox} fill={CERTIFICATE_QR_GROUND} />
        <path d={certificateQrPath(qr.data, qr.quietZone)} fill={CERTIFICATE_QR_MARK} />
      </svg>
      <figcaption className="sr-only">{qr.url}</figcaption>
    </figure>
  );
}
