import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import jwt from "jsonwebtoken";

export const { handlers: { GET, POST }, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "OTP Login",
      credentials: {
        token: { label: "JWT Token", type: "text" },
      },
      authorize: async (credentials) => {
        try {
          const token = credentials?.token;
          if (!token || typeof token !== 'string') return null;

          const decoded: any = jwt.verify(
            token,
            process.env.NEXTAUTH_SECRET!
          );

          // 🔒 ONLY LOGIN TOKEN IS ALLOWED
          if (decoded.type !== "login") return null;

          const adminNumbersEnv: string | undefined = process.env.ADMIN_NUMBERS;
          const adminNumbers = adminNumbersEnv ? adminNumbersEnv.split(',').map(s => s.trim()) : [];
          const role = adminNumbers.includes(decoded.userphone) ? "ADMIN" : (decoded.role || "USER");

          return {
            id: decoded.id,
            phone: decoded.userphone,
            role,
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
      if (session.user) {
        session.user.id = token.id;
        session.user.phone = token.phone;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
