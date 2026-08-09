import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  DEVICE_COOKIE,
  DEVICE_MAX_AGE,
  resolveDevice,
} from "@/lib/device";

// Anonymous identity for the Wall: no account required. The server mints an
// id, pins it to an httpOnly cookie, and hands it back so the client can
// compute proof-of-work with it. One device = one id = one 🔥 per message.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const legacy = body?.reactorId;

  const store = await cookies();
  const { deviceId, created } = resolveDevice(
    store.get(DEVICE_COOKIE)?.value,
    legacy,
  );
  if (created) {
    store.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return Response.json({ deviceId });
}
