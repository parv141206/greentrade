// auth.config.ts
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { collection, setDoc, doc } from "firebase/firestore";
import { db } from "~/lib/firebase";
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

        if (!pan || !gst) {
          console.log("Authorize: PAN or GST are required - returning null.");
          return null;
        }

        const user = validUsers.find((u) => u.pan === pan && u.gst === gst);

        if (!user) {
          console.log("Authorize: Invalid PAN or GST number - returning null.");
          return null;
        }

        if (!otp) {
          const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
          otpStore[user.email] = { otp: newOtp, timestamp: Date.now() };
          await sendOtp(user.email, newOtp);
          console.log(`Authorize: OTP ${newOtp} sent to ${user.email}`);
          throw new Error("OTP_SENT");
        }

        const storedOtpData = otpStore[user.email];

        if (!storedOtpData) {
          console.log(
            "Authorize: OTP not generated or expired (check 1) - returning null.",
          );
          return null;
        }

        const now = Date.now();
        const otpAgeSeconds = (now - storedOtpData.timestamp) / 1000;

        if (otpAgeSeconds > OTP_EXPIRY_SECONDS) {
          delete otpStore[user.email];
          console.log("Authorize: OTP has expired - returning null.");
          return null;
        }

        if (storedOtpData.otp !== otp) {
          console.log("Authorize: Invalid OTP provided - returning null.");
          return null;
        }

        delete otpStore[user.email];

        try {
          await setDoc(
            doc(collection(db, "companies"), user.pan),
            {
              pan: user.pan,
              gst: user.gst,
              email: user.email,
              companyName: "Default Company",
              address: "Default Address",
              phone: "0000000000",
              sector: "General",
              createdAt: new Date(),
            },
            { merge: true },
          );
        } catch (firebaseError) {
          console.error(
            "Authorize: Error storing company data in Firestore:",
            firebaseError,
          );
        }

        console.log(
          `Authorize: User ${user.email} authenticated successfully.`,
        );
        return { id: user.pan, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
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
        },
      };
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
