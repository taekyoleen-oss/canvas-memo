"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthStore {
  user: User | null;
  loading: boolean;
  init(): void;
  signOut(): Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  init() {
    const supabase = createClient();

    // 현재 세션 확인
    supabase.auth.getUser().then(({ data }) => {
      set({ user: data.user ?? null, loading: false });
    });

    // 세션 변화 구독
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, loading: false });
    });
  },

  async signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
