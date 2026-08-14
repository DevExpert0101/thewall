import { AppError, ERROR_CODES } from "@/lib/errors";

export type AdminIdentity = {
  id: string;
  email: string;
};

export function resolveAdminAccess(input: {
  authUserId: string | null | undefined;
  email: string | null | undefined;
  adminRow: { auth_user_id: string; email: string } | null;
  allowlisted: boolean;
}): AdminIdentity {
  const email = input.email?.trim().toLowerCase() ?? "";
  const id = input.authUserId ?? "";
  if (!id || !email) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Administrator sign-in required.", 401);
  }
  const rowMatch = input.adminRow?.auth_user_id === id;
  if (!rowMatch && !input.allowlisted) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Administrator sign-in required.", 403);
  }
  return { id, email };
}
