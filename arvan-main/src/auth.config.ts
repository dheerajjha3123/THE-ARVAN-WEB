import CredentialsProvider from "next-auth/providers/credentials";
import jwt from "jsonwebtoken";

export default {
  providers: [
    CredentialsProvider({
      name: "OTP Login",
      credentials: {
        token: { label: "JWT Token", type: "text" },
      },
      authorize: async (credentials) => {
        try {
          const token = credentials?.token;
          if (!token) return null;

          const decoded: any = jwt.verify(
            token,
            process.env.NEXTAUTH_SECRET!
          );

          // 🔒 ONLY LOGIN TOKEN IS ALLOWED
          if (decoded.type !== "login") return null;

          return {
            id: decoded.id,
            phone: decoded.userphone,
            role: decoded.role || "USER",
          };
        } catch (err) {
          console.error("Authorize error:", err);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.phone = (user as any).phone;
        token.role = (user as any).role;
      }
      return token;
    },

    async session({ session, token }: any) {
      session.user = {
        id: token.id as string,
        phone: token.phone as string,
        role: token.role as string,
      };
      return session;
    },
  },
};
