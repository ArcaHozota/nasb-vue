<script setup lang="ts">
// src/views/MainMenu.vue
// 旧 views/MainMenu.tsx を移植
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useFeedbackStore } from "@/stores/feedback";
import { DELAY_APOLOGY } from "@/constants";
import burgundy from "@/assets/burgundy.svg";
import bourbon from "@/assets/bourbon.svg";
import newaragon from "@/assets/newaragon.svg";

const router = useRouter();
const feedback = useFeedbackStore();

type MenuCard = {
  key: string;
  title: string;
  color: string;
  img: string;
  action: () => void;
};

const cards: MenuCard[] = [
  {
    key: "books",
    title: "聖書奉読",
    color: "#800020",
    img: burgundy,
    action: () => feedback.toast(DELAY_APOLOGY),
  },
  {
    key: "hymns",
    title: "賛美歌集め",
    color: "#006400",
    img: bourbon,
    action: () => router.push("/hymns"),
  },
  {
    key: "random",
    title: "ランダム選択",
    color: "#002fa7",
    img: newaragon,
    action: () => router.push("/hymns/random-five"),
  },
];

// 旧 mainmenu.js: localStorageのredirectMessage/loginMsgをトースト表示
onMounted(() => {
  const msg = localStorage.getItem("redirectMessage");
  if (msg) {
    feedback.toast(msg);
    localStorage.removeItem("redirectMessage");
  }
});
</script>

<template>
  <div>
    <h1 class="mb-8 text-3xl font-bold text-primary">メインメニュー</h1>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div
        v-for="card in cards"
        :key="card.key"
        class="group relative h-[66vh] cursor-pointer overflow-hidden rounded-lg shadow"
        @click="card.action"
      >
        <img :src="card.img" :alt="card.title" class="h-full w-full object-cover" />
        <div
          class="absolute bottom-0 w-full bg-black/35 py-3 text-center text-white transition-colors duration-200"
          :style="{ '--hover-color': card.color }"
        >
          <h2
            class="text-xl group-hover:!text-[var(--hover-color)]"
          >
            {{ card.title }}
          </h2>
        </div>
      </div>
    </div>
  </div>
</template>
