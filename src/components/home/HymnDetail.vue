<script setup lang="ts">
// PC版ホームの右カード: 選んだ曲の詳細。
//   一致度・曲名・韓国語名・YouTubeで聴く
//   楽譜: 登録済みの調をチップで並べ、押すとその調の楽譜をダウンロードする(オリジナルキーは塗りつぶし)
//   歌詞: 検索した語を黄色で強調して表示する
// 親が :key="hymn.id" で曲ごとに作り直す。
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import Highlighted from "@/components/Highlighted.vue";
import { extractErrorMessage } from "@/lib/constants";
import { keyLabel } from "@/lib/keySignature";
import { countHits, lyricQueryOptions } from "@/lib/lyrics";
import { scoreKeysQueryOptions } from "@/lib/scoreKeys";
import type { HymnSummary } from "@/api/hymns";
import { matchOf } from "./match";

const props = defineProps<{
  hymn: HymnSummary;
  terms: string[];
  download: (id: string, chord?: string) => Promise<void>;
}>();

const keysQuery = useQuery(scoreKeysQueryOptions(props.hymn.id));
const lyricQuery = useQuery(lyricQueryOptions(props.hymn.id));
const keys = computed(() => keysQuery.data.value ?? []);

// ダウンロード中の調(二重押しを防ぎ、そのチップに読み込み中を出す)
const downloading = ref<string | null>(null);
const onDownload = async (chord: string) => {
  if (downloading.value) return;
  downloading.value = chord;
  try {
    await props.download(props.hymn.id, chord);
  } finally {
    downloading.value = null;
  }
};

const match = computed(() =>
  props.terms.length > 0 ? matchOf(props.hymn.lineNumber) : null,
);
const lyric = computed(() => lyricQuery.data.value ?? "");
const hits = computed(() => countHits(lyric.value, props.terms));
const termsLabel = computed(() => props.terms.join("・"));
</script>

<template>
  <v-card
    flat
    rounded="xl"
    tag="article"
    class="hymn-detail"
    :aria-label="`${hymn.nameJp}の詳細`"
  >
    <div class="d-flex align-start justify-space-between ga-6">
      <div class="hymn-detail__heading">
        <v-chip
          v-if="match"
          :color="match.chip"
          variant="tonal"
          size="small"
          class="hymn-detail__match"
        >
          {{ match.label }}
        </v-chip>
        <h1 class="hymn-detail__title">{{ hymn.nameJp }}</h1>
        <p class="hymn-detail__kr">{{ hymn.nameKr }}</p>
      </div>
      <v-btn
        :href="hymn.link"
        target="_blank"
        rel="noopener noreferrer"
        color="#c62828"
        variant="flat"
        size="large"
        rounded="lg"
        prepend-icon="mdi-youtube"
        class="hymn-detail__yt"
      >
        YouTubeで聴く
      </v-btn>
    </div>

    <!-- 楽譜: 調のチップを押すと、その調の楽譜をダウンロードする -->
    <div class="hymn-detail__keys">
      <span class="hymn-detail__keys-label">𝄞 楽譜</span>
      <template v-if="keysQuery.isPending.value">
        <v-skeleton-loader
          v-for="i in 3"
          :key="i"
          type="chip"
          width="56"
          class="bg-transparent"
        />
      </template>
      <template v-else-if="keys.length > 0">
        <v-chip
          v-for="k in keys"
          :key="k.chord"
          :color="k.isOriginal ? 'primary' : undefined"
          :variant="k.isOriginal ? 'flat' : 'outlined'"
          :disabled="downloading !== null && downloading !== k.chord"
          :aria-label="`${keyLabel(k.chord)}${k.isOriginal ? '(オリジナルキー)' : ''}の楽譜をダウンロード`"
          class="hymn-detail__key"
          @click="onDownload(k.chord)"
        >
          <v-progress-circular
            v-if="downloading === k.chord"
            indeterminate
            size="14"
            width="2"
            class="mr-1"
          />
          {{ keyLabel(k.chord) }}{{ k.isOriginal ? "＊" : "" }}
        </v-chip>
        <span
          v-if="keys.some((k) => k.isOriginal)"
          class="hymn-detail__keys-note"
          >＊はオリジナルキー</span
        >
      </template>
      <span v-else-if="!keysQuery.error.value" class="hymn-detail__keys-note"
        >楽譜は登録されていません</span
      >
      <span v-if="keysQuery.error.value" class="hymn-detail__err">
        {{
          extractErrorMessage(keysQuery.error.value, "楽譜の確認に失敗しました")
        }}
      </span>
    </div>

    <p
      v-if="terms.length > 0 && lyricQuery.isSuccess.value"
      class="hymn-detail__hits"
      aria-live="polite"
    >
      {{
        hits > 0
          ? `「${termsLabel}」に一致: ${hits}箇所`
          : `「${termsLabel}」は歌詞に含まれていません（歌詞が似ている曲）`
      }}
    </p>
    <v-divider class="hymn-detail__divider" />

    <div class="hymn-detail__lyric-scroll">
      <div v-if="lyricQuery.isPending.value" class="d-flex justify-center py-10">
        <v-progress-circular indeterminate size="24" width="2" color="primary" />
      </div>
      <p v-if="lyricQuery.error.value" class="py-6 text-body-medium">
        {{ extractErrorMessage(lyricQuery.error.value, "歌詞の取得に失敗しました") }}
      </p>
      <template v-if="lyricQuery.isSuccess.value">
        <div v-if="lyric" class="hymn-detail__lyric">
          <Highlighted :text="lyric" :terms="terms" />
        </div>
        <p v-else class="py-6 text-body-medium hymn-detail__muted">
          歌詞が登録されていません。
        </p>
      </template>
    </div>
  </v-card>
</template>

<style scoped>
.hymn-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 28px 40px 0;
  border: 1px solid #e8e0cf;
  color: #2b1d14;
}
.hymn-detail__heading {
  min-width: 0;
}
.hymn-detail__match {
  margin-bottom: 8px;
  font-weight: 700;
}
.hymn-detail__title {
  font-family: "Noto Serif JP", serif;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.3;
}
.hymn-detail__kr {
  margin-top: 4px;
  font-family: "Noto Serif KR", serif;
  font-size: 1.25rem;
  color: #6b5d4a;
}
.hymn-detail__yt {
  flex-shrink: 0;
  font-weight: 700;
  letter-spacing: normal;
}
.hymn-detail__keys {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
.hymn-detail__keys-label,
.hymn-detail__keys-note {
  font-size: 0.875rem;
  color: #6b5d4a;
}
.hymn-detail__key {
  min-width: 48px;
  justify-content: center;
  font-weight: 600;
}
/* オリジナル以外の調は、薄い枠(文字は本文と同じ色) */
.hymn-detail__key.v-chip--variant-outlined {
  border-color: #d9cfbc;
}
.hymn-detail__err {
  font-size: 0.875rem;
  color: #800020;
}
.hymn-detail__hits {
  margin-top: 16px;
  font-size: 0.8125rem;
  color: #6b5d4a;
}
.hymn-detail__divider {
  flex-shrink: 0;
  margin-top: 12px;
  border-color: #e8e0cf;
  opacity: 1;
}
.hymn-detail__lyric-scroll {
  flex: 1;
  min-height: 0;
  padding: 16px 0 24px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.hymn-detail__lyric {
  font-size: 1.25rem;
  line-height: 2.1;
  white-space: pre-wrap;
  word-break: keep-all;
  overflow-wrap: anywhere;
}
.hymn-detail__muted {
  color: #6b5d4a;
}
</style>
