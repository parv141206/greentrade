import { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabase } from "~/lib/supabase";
import { sendOtp } from "~/lib/mailer";

const validUsers = [
  { pan: "ABCDE1234F", gst: "22AAAAA0000A1Z5", email: "parv141206@gmail.com" },
  { pan: "FGHIJ5666K", gst: "33BBBBB0000B2Z6", email: "test@example.com" },
  { pan: "KLMNO9012P", gst: "11CCCCC0000C3Z7", email: "another@example.com" },
];

let otpStore: Record<string, { otp: string; timestamp: number }> = {};
const OTP_EXPIRY_SECONDS = 5 * 60;

export const authConfig = {
  providers: [
    Credentials({
      name: "PAN-GST Login",
      credentials: {
        pan: { label: "PAN", type: "text" },
        gst: { label: "GST", type: "text" },
        otp: { label: "OTP", type: "text" },
      },
      async authorize(credentials) {
        const { pan, gst, otp } = credentials as {
          pan?: string;
          gst?: string;
          otp?: string;
        };

        if (!pan || !gst) return null;

        const user = validUsers.find((u) => u.pan === pan && u.gst === gst);
        if (!user) return null;

        if (!otp) {
          const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
          otpStore[user.email] = { otp: newOtp, timestamp: Date.now() };
          await sendOtp(user.email, newOtp);
          throw new Error("OTP_SENT");
        }

        const storedOtpData = otpStore[user.email];
        if (!storedOtpData) return null;

        const now = Date.now();
        const otpAgeSeconds = (now - storedOtpData.timestamp) / 1000;

        if (otpAgeSeconds > OTP_EXPIRY_SECONDS) {
          delete otpStore[user.email];
          return null;
        }

        if (storedOtpData.otp !== otp) return null;

        delete otpStore[user.email];

        return {
          id: user.pan,
          email: user.email,
          pan: user.pan,
          gst: user.gst,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as any).id;
        token.email = (user as any).email;
        token.pan = (user as any).pan;
        token.gst = (user as any).gst;
      }
      return token;
    },
    session: ({ session, token }) => {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          email: token.email as string,
          pan: token.pan as string,
          gst: token.gst as string,
        },
      };
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
