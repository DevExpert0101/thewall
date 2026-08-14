import {
  closeSimulatedWall,
  currentSimulatedEvent,
  hurrySimulatedClock,
  isSimulatedWallClosed,
  publishSimulatedMark,
  reopenSimulatedWall,
  resetSimulationState,
  runFullSimulation,
  warmSimulatedFires,
} from "@/lib/data/simulation";
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
    const body = bodySchema.parse(await readJson(request));
    let published: { publicNumber: number } | undefined;
    if (body.action === "reset") resetSimulationState();
    if (body.action === "reopen") reopenSimulatedWall();
    if (body.action === "close") closeSimulatedWall();
    if (body.action === "hurry") hurrySimulatedClock();
    if (body.action === "mark") published = publishSimulatedMark();
    if (body.action === "warm") warmSimulatedFires();
    if (body.action === "all") published = runFullSimulation();
    return jsonOk({
      ...snapshot(),
      publicNumber: published?.publicNumber,
    });
  } catch (error) {
    return jsonError(error);
  }
}
