export type TruthAuthorization = { isAuthorized: boolean };

export function assertOperationalSlateAuthorization(auth: TruthAuthorization): void {
  if (!auth.isAuthorized) {
    throw new Error("Clear Slate requires explicit administrative authorization");
  }
}