import jwt from "jsonwebtoken";

// Short-lived token the browser presents when opening a socket. It is
// scoped to exactly one user + document pair and expires in 60 seconds,
// so it's only useful for the handshake, not as a bearer credential.
// The WS server independently re-resolves the ACL on every connection -
// this token proves identity, it does not itself grant a role.

export interface WsTokenPayload {
  sub: string; // userId
  documentId: string;
}

const SECRET = process.env.WS_TOKEN_SECRET;

export function signWsToken(payload: WsTokenPayload): string {
  if (!SECRET) throw new Error("WS_TOKEN_SECRET is not set");
  return jwt.sign(payload, SECRET, { expiresIn: "60s" });
}
