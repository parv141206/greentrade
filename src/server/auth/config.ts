// File: Your authConfig file (e.g., auth.ts or similar)

import { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { supabase } from "~/lib/supabase";
import { sendOtp } from "~/lib/mailer";

// --- STEP 1: Add a 'role' to your user data source ---
const validUsers = [
  {
    pan: "ABCDE1234F",
    gst: "22AAAAA0000A1Z5",
    email: "parv141206@gmail.com",
    role: "admin",
  },
  {
    pan: "FGHIJ5666K",
    gst: "33BBBBB0000B2Z6",
    email: "parv141206@gmail.com",
    role: "user",
  },
  {
    pan: "KLMNO9012P",
    gst: "11CCCCC0000C3Z7",
    email: "parv141206@gmail.com",
    role: "user",
  },
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

        // --- STEP 2: Return the 'role' when authorization is successful ---
        return {
          id: user.pan,
          email: user.email,
          pan: user.pan,
          gst: user.gst,
          role: user.role, // <-- Add role here
        };
      },
    }),
  ],
  callbacks: {
    // --- STEP 3: Add the 'role' to the JWT token ---
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as any).id;
        token.email = (user as any).email;
        token.pan = (user as any).pan;
        token.gst = (user as any).gst;
        token.role = (user as any).role; // <-- Add role to the token
      }
      return token;
    },
    // --- STEP 4: Add the 'role' to the session object ---
    session: ({ session, token }) => {
      // The session object is what's returned to the frontend
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          email: token.email as string,
          pan: token.pan as string,
          gst: token.gst as string,
          role: token.role as string, // <-- Make role available in the session
        },
      };
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
