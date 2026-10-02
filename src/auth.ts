import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  imageUrl: string | null;
  isAdmin: boolean;
};

export type GoogleProfile = {
  googleId: string;
  email: string;
  displayName: string;
  imageUrl: string | null;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24;
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export function randomToken(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  let binary = "";
  for (const byte of new Uint8Array(digest))
    binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export async function verifyGoogleIdToken(
  token: string,
  clientId: string,
  expectedNonce: string,
): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(token, googleJwks, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true ||
    payload.nonce !== expectedNonce
  ) {
    throw new Error("Google ID token claims are invalid");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    displayName:
      typeof payload.name === "string"
        ? payload.name
        : payload.email.split("@")[0],
    imageUrl: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export async function createSessionToken(
  secret: string,
  user: AuthUser,
): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.displayName,
    isAdmin: user.isAdmin,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey(secret));
}

export async function verifySessionToken(
  secret: string,
  token: string,
): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    algorithms: ["HS256"],
  });
  return payload;
}
