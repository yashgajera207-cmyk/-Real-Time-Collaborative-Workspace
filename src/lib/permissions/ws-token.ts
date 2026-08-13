import jwt from "jsonwebtoken";

export interface SessionWsTokenPayload {
  sub: string;
  documentId: string;
}

export interface ShareWsTokenPayload {
  shareToken: string;
  documentId: string;
}

const SECRET = process.env.WS_TOKEN_SECRET;

export function signWsToken(payload: SessionWsTokenPayload): string {
  if (!SECRET) throw new Error("WS_TOKEN_SECRET is not set");
  return jwt.sign(payload, SECRET, { expiresIn: "60s" });
}

export function signShareWsToken(payload: ShareWsTokenPayload): string {
  if (!SECRET) throw new Error("WS_TOKEN_SECRET is not set");
  return jwt.sign(payload, SECRET, { expiresIn: "60s" });
}
