import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized({ auth, request }) {
      if (!auth?.user) {
        return false;
      }
      return true;
    },
  },
});
