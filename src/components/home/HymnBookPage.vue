<script setup lang="ts">
// PC版ホーム「開いた讃美歌集」の右ページ: 選んだ曲(旧 OpenHymnalHome.tsx の HymnPage)。
// 調を選ぶと五線譜の調号が変わり、五線譜を押すとその調の楽譜をダウンロードする。
// 歌詞は検索した語を下線で強調して表示する(歌詞の照合)。
// 親が :key="hymn.id" で曲ごとに作り直すので、選んだ調などの状態は曲を変えると初期化される。
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import Highlighted from "@/components/Highlighted.vue";
import KeyStaff from "@/components/home/KeyStaff.vue";
import { extractErrorMessage } from "@/lib/constants";
import { keyLabel } from "@/lib/keySignature";
import { countHits, lyricQueryOptions } from "@/lib/lyrics";
import { scoreKeysQueryOptions } from "@/lib/scoreKeys";
import type { HymnSummary } from "@/api/hymns";
import { matchOf } from "./match";

const props = defineProps<{
  hymn: HymnSummary;
  no: string;
  terms: string[];
  download: (id: string, chord?: string) => Promise<void>;
}>();

const keysQuery = useQuery(scoreKeysQueryOptions(props.hymn.id));
const lyricQuery = useQuery(lyricQueryOptions(props.hymn.id));
const keys = computed(() => keysQuery.data.value ?? []);

// 最初はオリジナルキー、無ければ並びの最初の調
const picked = ref<string | null>(null);
const chord = computed(() => {
  const list = keys.value;
  if (picked.value && list.some((k) => k.chord === picked.value)) return picked.value;
  return list.find((k) => k.isOriginal)?.chord ?? list[0]?.chord ?? null;
});
const isOriginal = computed(
  () => keys.value.find((k) => k.chord === chord.value)?.isOriginal ?? false,
);

const downloading = ref(false);
const onDownload = async () => {
  if (!chord.value) return;
  downloading.value = true;
  try {
    await props.download(props.hymn.id, chord.value);
  } finally {
    downloading.value = false;
  }
};

const staffState = computed(() =>
  keysQuery.isPending.value
    ? "loading"
    : keys.value.length === 0
      ? "empty"
      : downloading.value
        ? "downloading"
        : "ready",
);

const match = computed(() => (props.terms.length > 0 ? matchOf(props.hymn.lineNumber) : null));
const lyric = computed(() => lyricQuery.data.value ?? "");
const hits = computed(() => countHits(lyric.value, props.terms));
const termsLabel = computed(() => props.terms.join("・"));

const onPick = (v: unknown) => {
  // 選択済みを再クリックすると空になるので、選択を維持する
  if (typeof v === "string" && v) picked.value = v;
};
</script>

<template>
  <article class="book-page book-page--right" :aria-label="`${hymn.nameJp}の詳細`">
    <div class="d-flex align-start justify-space-between ga-4">
      <div style="min-width: 0">
        <span v-if="match" :class="['hymn-page__match', match.tone]">
          {{ match.mark }} {{ match.label }}
        </span>
        <h1 class="hymn-page__title">
          <span class="hymn-page__no">{{ no }}</span>　{{ hymn.nameJp }}
        </h1>
        <p class="noto-serif-kr hymn-page__kr">{{ hymn.nameKr }}</p>
      </div>
      <a :href="hymn.link" target="_blank" rel="noopener noreferrer" class="book-sans hymn-page__yt">
        <v-icon icon="mdi-youtube" size="16" aria-hidden="true" />
        YouTubeで聴く
      </a>
    </div>

    <!-- 五線譜: 選んだ調の調号を描き、押すとその調の楽譜をダウンロードする -->
    <KeyStaff :chord="chord" :is-original="isOriginal" :state="staffState" @download="onDownload" />

    <!-- 調を選ぶと上の五線譜の調号が変わる -->
    <div class="book-sans hymn-page__keys">
      <span>調を選ぶ</span>
      <template v-if="keysQuery.isPending.value">
        <v-skeleton-loader v-for="i in 3" :key="i" type="chip" width="44" height="30" class="bg-transparent" />
      </template>
      <v-btn-toggle
        v-if="keys.length > 0"
        :model-value="chord"
        aria-label="調を選ぶ"
        class="hymn-page__toggle"
        @update:model-value="onPick"
      >
        <v-btn v-for="k in keys" :key="k.chord" :value="k.chord" class="hymn-page__key">
          {{ keyLabel(k.chord) }}{{ k.isOriginal ? "＊" : "" }}
        </v-btn>
      </v-btn-toggle>
      <span v-if="keys.some((k) => k.isOriginal)" class="text-body-small">＊オリジナルキー</span>
      <span v-if="keysQuery.error.value" class="text-body-small hymn-page__err">
        {{ extractErrorMessage(keysQuery.error.value, "楽譜の確認に失敗しました") }}
      </span>
    </div>

    <div class="hymn-page__lyric-wrap">
      <p v-if="terms.length > 0 && lyricQuery.isSuccess.value" class="book-sans hymn-page__hits" aria-live="polite">
        {{
          hits > 0
            ? `「${termsLabel}」に一致: ${hits}箇所`
            : `「${termsLabel}」は歌詞に含まれていません（歌詞が似ている曲）`
        }}
      </p>
      <div class="hymn-page__lyric-scroll">
        <div class="book-lyric pr-2">
          <div v-if="lyricQuery.isPending.value" class="d-flex justify-center py-10">
            <v-progress-circular indeterminate size="24" width="2" color="primary" />
          </div>
          <p v-if="lyricQuery.error.value" class="book-sans py-6 text-body-medium">
            {{ extractErrorMessage(lyricQuery.error.value, "歌詞の取得に失敗しました") }}
          </p>
          <template v-if="lyricQuery.isSuccess.value">
            <Highlighted v-if="lyric" :text="lyric" :terms="terms" mark-class="book-mark" />
            <p v-else class="book-sans py-6 text-body-medium hymn-page__muted">歌詞が登録されていません。</p>
          </template>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.hymn-page__match {
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}
.hymn-page__title {
  margin-top: 4px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.25;
}
.hymn-page__no {
  color: #800020;
}
.hymn-page__kr {
  margin-top: 2px;
  font-size: 17px;
  color: #5a4630;
}
.hymn-page__yt {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid #800020;
  border-radius: 8px;
  font-size: 13px;
  color: #800020;
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}
.hymn-page__yt:hover {
  background: #800020;
  color: #fff;
}
.hymn-page__keys {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b5338;
}
.hymn-page__toggle {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  height: auto !important;
  border: 0 !important;
  background: transparent;
  overflow: visible;
}
.hymn-page__toggle .hymn-page__key {
  height: 30px !important;
  min-width: 44px;
  padding: 0 12px;
  border: 1px solid #c9b48d !important;
  border-radius: 8px !important;
  background: transparent;
  font-size: 13px;
  letter-spacing: normal;
  color: #2b1d14;
}
.hymn-page__toggle .hymn-page__key:hover {
  background: #f3e8cf;
}
.hymn-page__toggle .hymn-page__key.v-btn--active {
  border-color: #800020 !important;
  background: #800020;
  color: #fff;
}
.hymn-page__toggle .hymn-page__key.v-btn--active :deep(.v-btn__overlay) {
  opacity: 0;
}
.hymn-page__err {
  color: #800020;
}
.hymn-page__lyric-wrap {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid #e3d5b8;
}
.hymn-page__hits {
  margin-bottom: 4px;
  font-size: 0.75rem;
  color: #6b5338;
}
.hymn-page__lyric-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.hymn-page__muted {
  color: #6b5338;
}
/* 一致度の色(◆の表示) */
.tone-cadmium {
  color: #0d5c33;
}
.tone-burgundy {
  color: #800020;
}
.tone-naples {
  color: #8a6400;
}
.tone-related {
  color: #8a7a64;
}
</style>
