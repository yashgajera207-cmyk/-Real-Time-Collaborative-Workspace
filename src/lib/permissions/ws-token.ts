import jwt from "jsonwebtoken";

export interface SessionWsTokenPayload {
  sub: string;
  documentId: string;
}

export interface ShareWsTokenPayload {
  shareToken: string;
  documentId: string;
}

function getSecret(): string {
  const secret = process.env.WS_TOKEN_SECRET;
  if (!secret) throw new Error("WS_TOKEN_SECRET is not set");
  return secret;
}

export function signWsToken(payload: SessionWsTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "60s" });
}

export function signShareWsToken(payload: ShareWsTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "60s" });
}
