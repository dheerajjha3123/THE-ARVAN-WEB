import { Request as ExpressRequest, Response, NextFunction, RequestHandler } from "express";
import HttpStatusCodes from "../common/httpstatuscode.js";
import { RouteError } from "../common/routeerror.js";
import ENV from "../common/env.js";
import { NodeEnvs } from "../common/constants.js";
import { exceptionCodes } from "../common/prismafilter.js";
import { decode, getToken } from "next-auth/jwt";
import { prisma } from "../utils/prismaclient.js";
import axios from "axios";
import util from "util";
import jwt from "jsonwebtoken";

const isValidJWT = (token: string): boolean => {
  // JWT should have exactly 2 dots and be base64url encoded (allow padding '=' as some libs include it)
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => /^[A-Za-z0-9_\-=%]*$/.test(part));
};

const cleanMessage = (message: string) => message.replace(/(\r\n|\r|\n)/g, " ");
export const globalErrorHandler = (
  err: Error & { code?: string; meta?: any },
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): any => {
  // Log the error unless in test environment
  if (ENV.NODE_ENV !== NodeEnvs.Test.valueOf()) {
    console.error(err);
  }

  // Handle Prisma Known Request Error
  if (err instanceof (prisma as any).$extends.ErrorConstructor.PrismaClientKnownRequestError) {
    const statusCode = err.code ? exceptionCodes[err.code] : HttpStatusCodes.BAD_REQUEST;
    const message =
      ENV.NODE_ENV === "production" ? err.meta : cleanMessage(err.message);
    return res.status(statusCode).json({
      success: false,
      statusCode,
      path: req.url,
      message,
    });
  }

  // Handle Prisma Unknown Request Error
  if (err instanceof (prisma as any).$extends.ErrorConstructor.PrismaClientUnknownRequestError) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatusCodes.INTERNAL_SERVER_ERROR,
      path: req.url,
      message: "Something went wrong",
    });
  }

  // Handle Prisma Validation Error
  if (err instanceof (prisma as any).$extends.ErrorConstructor.PrismaClientValidationError) {
    const indexOfArgument = err.message.indexOf("Argument");
    const message = cleanMessage(err.message.substring(indexOfArgument));
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      statusCode: HttpStatusCodes.BAD_REQUEST,
      path: req.url,
      message,
    });
  }

  // Handle custom RouteError
  if (err instanceof RouteError) {

    return res.status(err.status).json({ success: false, error: err.message });
  }
  if (axios.isAxiosError(err)) {
    console.log(JSON.stringify(err,null, 2));
    if (err.response) {
      // The request was made, and the server responded with a status code
      return res.status(err.response.status).json({
        success: false,
        statusCode: err.response.status,
        path: req.url,
        message: err.response.data?.message || "Axios error response",
      });
    } else if (err.request) {
      // The request was made but no response was received
      return res.status(HttpStatusCodes.GATEWAY_TIMEOUT).json({
        success: false,
        statusCode: HttpStatusCodes.GATEWAY_TIMEOUT,
        path: req.url,
        message: "No response from server",
      });
    } else {
      // Something happened in setting up the request
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        statusCode: HttpStatusCodes.BAD_REQUEST,
        path: req.url,
        message: err.message || "Axios request setup error",
      });
    }
  }
  // Fallback for all other errors
  return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    statusCode: HttpStatusCodes.INTERNAL_SERVER_ERROR,
    path: req.url,
    message: err.message || "Internal Server Error",
  });
};
declare global {
  namespace Express {
    interface Request {
      user?: any; // Add a `session` property to the Request interface
    }
  }
}

function extractBearerToken(headerValue?: string | string[] | null): string | null {
  if (!headerValue) return null;
  const hv = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!hv || typeof hv !== "string") return null;

  // Split the header on whitespace and pick the first token-looking substring (handles "token otp" or "Bearer token otp")
  const parts = hv.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    // Accept standard JWT pattern (three dot-separated parts) or match using isValidJWT
    if (p && p.includes('.') && isValidJWT(p)) {
      return p.trim();
    }
  }

  // As a final fallback, match "Bearer <rest>" case-insensitively and return the rest (could be a token with spaces)
  const m = hv.match(/^\s*Bearer\s+(.+)$/i);
  if (m) return m[1].trim();

  // Nothing recognizable
  return null;
}

export const authenticateJWT: RequestHandler = async (
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    // Normalize path check to lowercase for robust OTP-route skipping
    const pathLower = (req.path || "").toLowerCase();
    // Match common OTP/get endpoints (case-insensitive)
    if (
      pathLower.includes('/otp') ||
      pathLower.includes('getotp') ||
      pathLower.includes('get-otp') ||
      pathLower.includes('verify-otp') ||
      pathLower.includes('verifyotp') ||
      pathLower.includes('/reset-password') ||
      pathLower.includes('resend-otp') ||
      pathLower.includes('resendotp')
    ) {
      return next();
    }

    if (!ENV.AUTH_SECRET) {
      // Helpful warning for deployment environments
      console.warn("AUTH_SECRET is not set. JWT verification will fail if tokens are signed with a secret.");
    }

    let userRecord = null;
    let decodedToken: any = null;

    // Robust token extraction: header (case-insensitive Bearer), body, query
    const rawAuthHeader = (req.headers.authorization as string) || (req.headers as any).Authorization || null;
    let jwtToken = extractBearerToken(rawAuthHeader);

    // Accept token via body or query as a fallback (useful for some clients)
    if (!jwtToken) {
      if ((req as any).body && (req as any).body.token) jwtToken = (req as any).body.token;
      else if (req.query && (req.query as any).token) jwtToken = String((req.query as any).token);
    }

    // First, try to get user from Authorization header (JWT token)
    if (jwtToken && jwtToken.trim() !== '' && isValidJWT(jwtToken.trim())) {
      try {
        // allow some clock skew
        decodedToken = jwt.verify(jwtToken, ENV.AUTH_SECRET, { clockTolerance: 300 }) as any;
        // If this is a 'verify' type token (OTP flow), skip auth and continue to handler
        if (decodedToken && (decodedToken.type === "verify" || decodedToken.type === "otp" || decodedToken.userphone)) {
          // NOTE: We allow token type 'verify' to pass; request handler should still validate OTP as needed
          return next();
        }
        if (decodedToken && decodedToken.id) {
          userRecord = await prisma.user.findUnique({
            where: { id: decodedToken.id },
          });
        }
      } catch (jwtError) {
        console.error("JWT verification failed:", jwtError);
        // Continue to fallback
      }
    }

    if (!userRecord) {
      // Fallback: try to get session from Authorization header (NextAuth session token)
      // The session token may be the entire bearer value, so reuse jwtToken variable
      const sessionToken = jwtToken || (rawAuthHeader ? String(rawAuthHeader).trim() : undefined);
      if (sessionToken) {
        try {
          const session = await prisma.session.findUnique({
            where: { sessionToken },
            include: { user: true },
          });
          if (session && session.user && new Date(session.expires) > new Date()) {
            userRecord = session.user;
            decodedToken = { id: session.user.id, role: session.user.role };
          }
        } catch (sessionError) {
          console.error("Session lookup failed:", sessionError);
          // Continue to fallback
        }
      }
    }

    // Fallback: Try to decode JWT from Authorization header (if it's a JWT) — second attempt with longer tolerance
    if (!userRecord && jwtToken && jwtToken.trim() !== '' && isValidJWT(jwtToken.trim())) {
      try {
        decodedToken = jwt.verify(jwtToken, ENV.AUTH_SECRET, { clockTolerance: 60 * 60 * 24 * 365 * 10 }) as any;
        if (decodedToken && decodedToken.id) {
          userRecord = await prisma.user.findUnique({
            where: { id: decodedToken.id },
          });
        }
      } catch (jwtError) {
        console.error("JWT verification failed (second attempt):", jwtError);
        // Continue to fallback
      }
    }

    // Fallback: Try to get token from next-auth JWT (for compatibility)
    if (!userRecord) {
      try {
        const token = await getToken({ req: req as any, secret: ENV.AUTH_SECRET });
        if (token) {
          decodedToken = token;
          userRecord = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
        }
      } catch (getTokenErr) {
        console.error("getToken failed:", getTokenErr);
      }
    }

    // Final fallback: check if Authorization header has user ID (legacy)
    if (!userRecord && rawAuthHeader) {
      const raw = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;
      const candidate = raw.trim();
      if (candidate && candidate.length < 50) { // Assuming userId is short, JWT is long
        try {
          userRecord = await prisma.user.findUnique({
            where: { id: candidate },
          });
        } catch (e) {
          // ignore
        }
      }
    }

    if (!userRecord) {
      throw new RouteError(403, "Unauthorized: No valid token or user found");
    }

    req.user = userRecord;

    // Override role with token role if available (for admin designation via ADMIN_NUMBERS)
    if (decodedToken && decodedToken.role) {
      req.user.role = decodedToken.role;
    }

    next();
  } catch (error: unknown) {
    console.error("Failed to authenticate", error);
    // Instead of throwing an error, just skip authentication for OTP endpoints
    const pathLower = (req.path || "").toLowerCase();
    if (
      pathLower.includes('/otp') ||
      pathLower.includes('getotp') ||
      pathLower.includes('get-otp') ||
      pathLower.includes('verify-otp') ||
      pathLower.includes('verifyotp') ||
      pathLower.includes('/reset-password') ||
      pathLower.includes('resend-otp') ||
      pathLower.includes('resendotp')
    ) {
      return next();
    }
    throw new RouteError(401, "Unauthorized");
  }
};


export const isAdmin: RequestHandler = (req: ExpressRequest, res: Response, next: NextFunction) => {
  const adminNumbersEnv: string | undefined = (ENV as any).ADMIN_NUMBERS;
  const adminNumbers = adminNumbersEnv ? adminNumbersEnv.split(',').map((s: string) => s.trim()) : [];
  const userPhone = req.user?.phone || req.user?.userphone || req.user?.mobile_no || "";

  if (adminNumbers.includes(userPhone)) {
    return next();
  }

  // fallback to role check if phone is not listed as admin
  if (req.user.role === "USER") {
    throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
  }
  next();
};
