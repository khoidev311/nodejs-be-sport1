import jwt from "jsonwebtoken";
import env from "../config/env";

export interface AccessTokenPayload {
  sub: string; // user id
  username: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

const signAccessToken = (userId: string, username: string) =>
  jwt.sign({ sub: userId, username, type: "access" } satisfies AccessTokenPayload, env.accessTokenSecret, {
    expiresIn: env.accessTokenTtl,
  });

const signRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId, type: "refresh" } satisfies RefreshTokenPayload, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenTtl,
  });

const issueTokens = (userId: string, username: string) => ({
  access_token: signAccessToken(userId, username),
  refresh_token: signRefreshToken(userId),
});

const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, env.accessTokenSecret);
  if (typeof payload !== "object" || payload.type !== "access" || typeof payload.sub !== "string") {
    throw new jwt.JsonWebTokenError("Invalid access token");
  }
  return payload as unknown as AccessTokenPayload;
};

const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const payload = jwt.verify(token, env.refreshTokenSecret);
  if (typeof payload !== "object" || payload.type !== "refresh" || typeof payload.sub !== "string") {
    throw new jwt.JsonWebTokenError("Invalid refresh token");
  }
  return payload as unknown as RefreshTokenPayload;
};

const extractBearer = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token ? token : null;
};

export { issueTokens, verifyAccessToken, verifyRefreshToken, extractBearer };
