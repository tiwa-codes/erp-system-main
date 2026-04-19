"use client";

import { signIn } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SsoHandler() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      signIn("mobile-jwt", { token, callbackUrl: "/" });
    }
  }, [token]);

  return null;
}

export default function MobileSsoPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#BE1522" }}>
      {/* Aspirage Logo / Spinner */}
      <div className="flex flex-col items-center gap-6">
        {/* Animated logo ring */}
        <div className="relative flex items-center justify-center">
          <div
            className="absolute h-24 w-24 rounded-full border-4 border-white/30 animate-spin"
            style={{ borderTopColor: "white" }}
          />
          <div className="h-16 w-16 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
            <img src="/logo.jpg" alt="Aspirage" className="h-12 w-12 rounded-xl object-cover" />
          </div>
        </div>

        {/* Text */}
        <div className="text-center">
          <h1 className="text-white font-bold text-2xl tracking-tight">Aspirage</h1>
          <p className="text-white/70 text-sm mt-1">Setting up your secure session…</p>
        </div>

        {/* Dot loader */}
        <div className="flex gap-2 mt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-white/80 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      <Suspense fallback={null}>
        <SsoHandler />
      </Suspense>
    </div>
  );
}
