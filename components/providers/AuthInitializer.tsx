"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

export default function AuthInitializer() {
  const initAuth = useAuthStore((s) => s.init);
  useEffect(() => {
    initAuth();
  }, [initAuth]);
  return null;
}
