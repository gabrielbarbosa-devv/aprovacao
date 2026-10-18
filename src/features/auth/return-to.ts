const oauthConsentPath = /^\/oauth\/consent\?authorization_id=[A-Za-z0-9_-]{1,200}$/;

export function getSafeAuthReturnTo(value: string | null | undefined): string {
  return value && oauthConsentPath.test(value) ? value : "/";
}
