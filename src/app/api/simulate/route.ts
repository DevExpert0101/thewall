import {
  closeSimulatedWall,
  isSimulatedWallClosed,
  reopenSimulatedWall,
} from "@/lib/data/simulation";
import { isSimulation } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["close", "reopen"]),
});

function requireSimulation() {
  if (!isSimulation()) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Simulation controls are off.", 404);
  }
}

export async function GET() {
  try {
    requireSimulation();
    return jsonOk({
      simulation: true,
      closed: isSimulatedWallClosed(),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSimulation();
    const body = bodySchema.parse(await readJson(request));
    if (body.action === "close") closeSimulatedWall();
    if (body.action === "reopen") reopenSimulatedWall();
    return jsonOk({
      simulation: true,
      closed: isSimulatedWallClosed(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
