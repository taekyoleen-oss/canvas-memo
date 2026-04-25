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
      const user = data.user ?? null;
      set({ user, loading: false });
      // '받은 메모' 보드는 add-in Browser 연결 시 자동 생성 — canvas-memo 자체에서는 생성하지 않음
    });

    // 세션 변화 구독
    supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      set({ user, loading: false });
    });
  },

  async signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
