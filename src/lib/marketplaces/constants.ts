/** Sentinel stored in access_token for guided/manual marketplace flows. */
export const GUIDED_CONNECTION_TOKEN = 'guided';

export function isGuidedConnection(accessToken: string): boolean {
  return accessToken === GUIDED_CONNECTION_TOKEN;
}
