"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button 
      className="px-4 py-2 rounded-lg transition-all duration-300 bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm hover:shadow-md hover:translate-y-[-1px]" 
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
