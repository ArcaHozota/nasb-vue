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
    img: "/assets/burgundy.svg",
    action: () => feedback.toast(DELAY_APOLOGY),
  },
  {
    key: "hymns",
    title: "賛美歌集め",
    img: "/assets/bourbon.svg",
    action: () => router.push("/hymns"),
  },
  {
    key: "random",
    title: "ランダム選択",
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
    <h1 class="text-headline-medium font-weight-bold text-primary mb-8">
      メインメニュー
    </h1>

    <div class="menu-grid">
      <!-- Vuetify の v-card(クリックで波紋・ホバーで影が深くなる)をそのまま使う -->
      <v-card
        v-for="card in cards"
        :key="card.key"
        class="menu-card"
        rounded="lg"
        elevation="2"
        hover
        @click="card.action"
      >
        <img :src="card.img" :alt="card.title" class="menu-card__img" />
        <div class="menu-card__caption">
          <h2>{{ card.title }}</h2>
        </div>
      </v-card>
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
  height: 66vh;
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
}
</style>
