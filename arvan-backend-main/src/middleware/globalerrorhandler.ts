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
  // JWT should have exactly 2 dots and be base64url encoded
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => /^[A-Za-z0-9_-]*$/.test(part));
};

const verifyJWT = (token: string) => {
  const decoded = jwt.decode(token) as any;
  if (!decoded) throw new Error('Invalid token');
  const now = Math.floor(Date.now() / 1000);
  const clockTimestamp = Math.max(now, decoded.iat);
  return jwt.verify(token, ENV.NEXTAUTH_SECRET, { clockTolerance: 300, clockTimestamp });
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
  if (err && typeof err === 'object' && 'code' in err && err.code && exceptionCodes[err.code]) {
    const statusCode = exceptionCodes[err.code];
    const message =
      ENV.NODE_ENV === "production" ? (err.meta as any)?.message || "Database error" : cleanMessage(err.message);
    return res.status(statusCode).json({
      success: false,
      statusCode,
      path: req.url,
      message,
    });
  }

  // Handle Prisma Unknown Request Error
  if (err.code === 'P1001' || err.code === 'P1017' || err.message?.includes('Unknown request error')) {
    return res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatusCodes.INTERNAL_SERVER_ERROR,
      path: req.url,
      message: "Something went wrong",
    });
  }

  // Handle Prisma Validation Error
  if (err.code === 'P2000' || err.code === 'P2001' || err.code === 'P2002' || err.message?.includes('Validation error')) {
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

export const authenticateJWT: RequestHandler = async (
  req: ExpressRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    // Allow skipping auth check on OTP-related endpoints
    const publicAuthRoutes = [
     "/otp",
     "/verify-otp",
     "/resend-otp",
     "/reset-password",
   ];

    if (publicAuthRoutes.some(route => req.originalUrl.includes(route))) {
      return next();
    }

    let userRecord = null;
    let decodedToken = null;

    // PRIMARY: Try NextAuth session token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7).trim();
      console.log("🔍 Checking token:", sessionToken.substring(0, 20) + "...");
      console.log("🔍 Token length:", sessionToken.length);
      console.log("🔍 Is JWT?", isValidJWT(sessionToken));

      // Check if it's a NextAuth session token (not JWT)
      if (sessionToken && sessionToken.length > 50 && !isValidJWT(sessionToken)) {
        try {
          console.log("🔍 Looking up session in database...");
          const session = await prisma.session.findUnique({
            where: { sessionToken },
            include: { user: true },
          });

          console.log("🔍 Session found:", !!session);
          if (session) {
            console.log("🔍 Session expires:", session.expires);
            console.log("🔍 Current time:", new Date());
            console.log("🔍 Is expired?", new Date(session.expires) <= new Date());
          }

          if (session && session.user && new Date(session.expires) > new Date()) {
            userRecord = session.user;
            decodedToken = { id: session.user.id, role: session.user.role };
            console.log("✅ Authenticated via NextAuth session token");
          } else {
            console.log("❌ Session invalid or expired");
          }
        } catch (sessionError) {
          console.error("Session lookup failed:", sessionError);
        }
      } else {
        console.log("❌ Token is JWT or too short, skipping session lookup");
      }
    } else {
      console.log("❌ No Bearer token in Authorization header");
    }

    // SECONDARY: Try NextAuth JWT token
    if (!userRecord) {
      try {
        const token = await getToken({ req: req as any, secret: ENV.NEXTAUTH_SECRET });
        if (token && token.id) {
          decodedToken = token;
          userRecord = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
          console.log("✅ Authenticated via NextAuth JWT token");
        }
      } catch (nextAuthError) {
        console.error("NextAuth token retrieval failed:", nextAuthError);
      }
    }

    // TERTIARY: Try custom JWT tokens (for OTP login)
    if (!userRecord && authHeader && authHeader.startsWith('Bearer ')) {
      const jwtToken = authHeader.substring(7).trim();

      if (jwtToken && isValidJWT(jwtToken)) {
        try {
          decodedToken = verifyJWT(jwtToken) as any;

          if (decodedToken && decodedToken.type === "login") {
            // Find user by ID first, then by phone
            if (decodedToken.id) {
              userRecord = await prisma.user.findUnique({
                where: { id: decodedToken.id },
              });
            }

            if (!userRecord && decodedToken.userphone) {
              userRecord = await prisma.user.findUnique({
                where: { mobile_no: decodedToken.userphone },
              });
            }

            if (userRecord) {
              console.log("✅ Authenticated via custom JWT token");
            }
          }
        } catch (jwtError) {
          console.error("JWT verification failed:", jwtError);
        }
      }
    }

    if (!userRecord) {
      throw new RouteError(403, "Unauthorized: No valid token or user found");
    }

    req.user = userRecord;

    // Override role with token role if available
    if (decodedToken && decodedToken.role) {
      req.user.role = decodedToken.role;
    }

    next();
  } catch (error: unknown) {
    console.error("Failed to authenticate", error);
    throw new RouteError(401, "Unauthorized");
  }
};


export const isAdmin: RequestHandler = (req: ExpressRequest, res: Response, next: NextFunction) => {
  const adminNumbersEnv: string | undefined = (ENV as any).ADMIN_NUMBERS;
  const adminNumbers = adminNumbersEnv ? adminNumbersEnv.split(',').map((s: string) => s.trim()) : [];
  const userPhone = req.user?.mobile_no || "";

  if (adminNumbers.includes(userPhone)) {
    return next();
  }

  // Check if user has ADMIN role
  if (req.user?.role === "ADMIN") {
    return next();
  }

  throw new RouteError(HttpStatusCodes.UNAUTHORIZED, "Unauthorized");
};
