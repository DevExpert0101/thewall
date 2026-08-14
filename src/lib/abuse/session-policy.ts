export function shouldCreateAnonymousUser(
  existingUserId: string | null | undefined,
): existingUserId is null | undefined {
  return !existingUserId;
}
