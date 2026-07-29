<script setup lang="ts">
// src/layouts/AdminLayout.vue
// このステップでは認証ガード配下であることの確認に留め、
// AppBar/Drawer/ユーザーメニュー(旧 layouts/AdminLayout.tsx のUI部分)は
// ステップ4でTailwindの自作コンポーネントとして実装する。
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
</script>

<template>
  <div class="flex min-h-screen">
    <!-- 仮の左サイドバー。ステップ4でAppBar/Drawer/ユーザーメニューに置き換える -->
    <aside class="w-16 shrink-0 bg-gray-900" />
    <div class="flex-1">
      <header class="flex h-12 items-center justify-end bg-gray-900 px-4 text-sm text-white">
        {{ auth.username }}
      </header>
      <main class="p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>
