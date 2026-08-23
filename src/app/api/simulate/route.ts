import {
  closeSimulatedWall,
  currentSimulatedEvent,
  hurrySimulatedClock,
  isSimulatedWallClosed,
  publishSimulatedMark,
  listSimulatedEditions,
  reopenSimulatedWall,
  startScratchSimulation,
  runFullSimulation,
  warmSimulatedFires,
} from "@/lib/data/simulation";
import { markSimulatedClosed } from "@/lib/data/simulation-session";
import { requireAdmin } from "@/lib/auth";
import { isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["close", "reopen", "reset", "hurry", "mark", "warm", "all"]),
});

function requireSimulation() {
  if (!isSimulation()) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Simulation controls are off.", 404);
  }
}

function snapshot() {
  const event = currentSimulatedEvent();
  return {
    simulation: true,
    closed: isSimulatedWallClosed(),
    phase: event.phase,
    endsAt: event.endsAt,
    startsAt: event.startsAt,
    serverNow: event.serverNow,
    totalMessages: event.totalMessages,
    totalReactions: event.totalReactions,
    editionNumber: event.editionNumber ?? listSimulatedEditions().at(-1)?.editionNumber ?? 1,
    editionCount: listSimulatedEditions().length,
  };
}

export async function GET() {
  try {
    requireSimulation();
    return jsonOk(snapshot());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSimulation();
    await requireAdmin();
    const body = bodySchema.parse(await readJson(request));
    let published: { publicNumber: number } | undefined;
    if (body.action === "reset") {
      startScratchSimulation();
      await markSimulatedClosed(false);
    }
    if (body.action === "reopen") {
      reopenSimulatedWall();
      await markSimulatedClosed(false);
    }
    if (body.action === "close") {
      closeSimulatedWall();
      await markSimulatedClosed(true);
    }
    if (body.action === "hurry") hurrySimulatedClock();
    if (body.action === "mark") published = publishSimulatedMark();
    if (body.action === "warm") warmSimulatedFires();
    if (body.action === "all") {
      published = runFullSimulation();
      await markSimulatedClosed(false);
    }
    return jsonOk({
      ...snapshot(),
      publicNumber: published?.publicNumber,
    });
  } catch (error) {
    return jsonError(error);
  }
}
