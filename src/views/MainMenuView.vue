<script setup lang="ts">
// メインメニュー(旧 (admin)/mainmenu/page.tsx)
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useFeedbackStore } from "@/stores/feedback";
import { DELAY_APOLOGY } from "@/lib/constants";
import { consumeRedirectMessage } from "@/lib/session";

const router = useRouter();
const feedback = useFeedbackStore();

const cards = [
  {
    key: "books",
    title: "聖書奉読",
    color: "#800020",
    img: "/assets/burgundy.svg",
    action: () => feedback.toast(DELAY_APOLOGY),
  },
  {
    key: "hymns",
    title: "賛美歌集め",
    color: "#002fa7",
    img: "/assets/bourbon.svg",
    action: () => router.push("/hymns"),
  },
  {
    key: "random",
    title: "ランダム選択",
    color: "#006400",
    img: "/assets/newaragon.svg",
    action: () => router.push("/hymns/random-five"),
  },
];

// ログイン時のメッセージ(localStorage の redirectMessage)をトーストで出す
onMounted(() => {
  const msg = consumeRedirectMessage();
  if (msg) feedback.toast(msg);
});
</script>

<template>
  <div>
    <h1 class="text-headline-medium font-weight-bold text-primary mb-8">メインメニュー</h1>

    <div class="menu-grid">
      <!-- 押せる面なので <button> を土台にする。浮き上がり・カードごとの色の光・押したときの縮みは CSS で -->
      <button
        v-for="card in cards"
        :key="card.key"
        type="button"
        class="menu-card"
        :style="{ '--hover-color': card.color }"
        @click="card.action"
      >
        <img :src="card.img" :alt="card.title" class="menu-card__img" />
        <div class="menu-card__caption">
          <h2>{{ card.title }}</h2>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .menu-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.menu-card {
  position: relative;
  display: block;
  width: 100%;
  height: 66vh;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  text-align: left;
  transition: translate 0.3s, scale 0.3s, box-shadow 0.3s;
}
.menu-card:hover {
  translate: 0 -4px;
  box-shadow: 0 12px 32px color-mix(in srgb, var(--hover-color) 45%, transparent);
}
.menu-card:active {
  scale: 0.98;
}
.menu-card:focus-visible {
  outline: 3px solid rgba(128, 0, 32, 0.5);
}
.menu-card__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.menu-card__caption {
  position: absolute;
  bottom: 0;
  width: 100%;
  padding: 12px 0;
  background: rgba(0, 0, 0, 0.35);
  text-align: center;
  color: #fff;
}
.menu-card__caption h2 {
  font-size: 1.25rem;
  font-weight: 400;
  transition: color 0.2s;
}
.menu-card:hover .menu-card__caption h2 {
  color: var(--hover-color);
}
</style>
