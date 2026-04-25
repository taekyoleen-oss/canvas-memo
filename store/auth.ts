"use client";

import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ensureInboxBoard } from "@/lib/inboxBoard";

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
      const user = data.user ?? null;
      set({ user, loading: false });
      if (user) ensureInboxBoard(user.id).catch(console.error);
    });

    // 세션 변화 구독
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({ user, loading: false });
      if (user) ensureInboxBoard(user.id).catch(console.error);
    });
  },

  async signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
