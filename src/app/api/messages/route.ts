import { cookies } from "next/headers";
import { getLiveMessages } from "@/lib/server";
import { supabase } from "@/lib/supabase";
import { DEVICE_COOKIE, validDeviceId } from "@/lib/device";

export async function GET() {
  const messages = await getLiveMessages();

  const store = await cookies();
  const deviceId = validDeviceId(store.get(DEVICE_COOKIE)?.value)
    ? store.get(DEVICE_COOKIE)!.value
    : null;

  let reacted: string[] = [];
  if (deviceId) {
    const { data } = await supabase.rpc("reacted_ids", { rid: deviceId });
    reacted = Array.isArray(data) ? (data as string[]) : [];
  }

  return Response.json({ messages, reacted });
}
