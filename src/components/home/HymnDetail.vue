<script setup lang="ts">
// ホームの曲の詳細(PC版は右のカード、モバイル版は下から出るシートの中。compact で幅の狭い表示にする)。
//   一致度・曲名・韓国語名・YouTubeで聴く
//   楽譜: 調のチップで調を選ぶと、下の五線譜の調号が変わる。五線譜を押すとその調の楽譜をダウンロードする
//   歌詞: 検索した語を黄色で強調して表示する
// 親が :key="hymn.id" で曲ごとに作り直す。
import { computed, ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import Highlighted from "@/components/Highlighted.vue";
import KeyStaff from "@/components/home/KeyStaff.vue";
import { extractErrorMessage } from "@/lib/constants";
import { keyColor, keyLabel } from "@/lib/keySignature";
import { countHits, lyricQueryOptions } from "@/lib/lyrics";
import { scoreKeysQueryOptions } from "@/lib/scoreKeys";
import type { HymnSummary } from "@/api/hymns";
import { matchOf } from "./match";

const props = defineProps<{
  hymn: HymnSummary;
  terms: string[];
  download: (id: string, chord?: string) => Promise<void>;
  /** モバイル用: 余白・文字を小さくし、YouTube ボタンを曲名の下に置く */
  compact?: boolean;
}>();

const keysQuery = useQuery(scoreKeysQueryOptions(props.hymn.id));
const lyricQuery = useQuery(lyricQueryOptions(props.hymn.id));
const keys = computed(() => keysQuery.data.value ?? []);

// 最初はオリジナルキー、無ければ並びの最初の調
const picked = ref<string | null>(null);
const chord = computed(() => {
  const list = keys.value;
  if (picked.value && list.some((k) => k.chord === picked.value))
    return picked.value;
  return list.find((k) => k.isOriginal)?.chord ?? list[0]?.chord ?? null;
});
const isOriginal = computed(
  () => keys.value.find((k) => k.chord === chord.value)?.isOriginal ?? false,
);
const onPick = (v: unknown) => {
  // 選択済みを再クリックすると空になるので、選択を維持する
  if (typeof v === "string" && v) picked.value = v;
};

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
    :class="['hymn-detail', { 'hymn-detail--compact': compact }]"
    :aria-label="`${hymn.nameJp}の詳細`"
  >
    <div class="hymn-detail__head">
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
        color="primary"
        variant="flat"
        :size="compact ? 'default' : 'large'"
        rounded="lg"
        prepend-icon="mdi-youtube"
        class="hymn-detail__yt"
      >
        YouTubeで聴く
      </v-btn>
    </div>

    <!-- 楽譜: 調のチップで調を選ぶと、下の五線譜の調号が変わる(調ごとの色。選んだ調は塗りつぶし) -->
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
      <v-chip-group
        v-else-if="keys.length > 0"
        :model-value="chord"
        aria-label="調を選ぶ"
        column
        class="py-0"
        @update:model-value="onPick"
      >
        <v-chip
          v-for="k in keys"
          :key="k.chord"
          :value="k.chord"
          :color="keyColor(k.chord)"
          :base-color="keyColor(k.chord)"
          :variant="k.chord === chord ? 'flat' : 'outlined'"
          class="hymn-detail__key"
        >
          {{ keyLabel(k.chord) }}{{ k.isOriginal ? "＊" : "" }}
        </v-chip>
      </v-chip-group>
      <span v-if="keys.some((k) => k.isOriginal)" class="hymn-detail__keys-note"
        >＊はオリジナルキー</span
      >
      <span v-if="keysQuery.error.value" class="hymn-detail__err">
        {{
          extractErrorMessage(keysQuery.error.value, "楽譜の確認に失敗しました")
        }}
      </span>
    </div>

    <!-- 五線譜: 選んだ調の調号を描き、押すとその調の楽譜をダウンロードする -->
    <KeyStaff
      :chord="chord"
      :is-original="isOriginal"
      :state="staffState"
      class="hymn-detail__staff"
      @download="onDownload"
    />

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
      <div
        v-if="lyricQuery.isPending.value"
        class="d-flex justify-center py-10"
      >
        <v-progress-circular
          indeterminate
          size="24"
          width="2"
          color="primary"
        />
      </div>
      <p v-if="lyricQuery.error.value" class="py-6 text-body-medium">
        {{
          extractErrorMessage(
            lyricQuery.error.value,
            "歌詞の取得に失敗しました",
          )
        }}
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
.hymn-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
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
/* 調ごとの色: 選んでいない調はその色の枠と文字、選んだ調はその色で塗りつぶす(文字色は Vuetify が見やすい方を選ぶ)。
   選んだ調に Vuetify が重ねる白い膜(選択の表示)は消し、指定どおりの色にする */
.hymn-detail__key.v-chip--selected :deep(.v-chip__overlay) {
  opacity: 0;
}
/* Vuetify の outlined は枠線 1px が外側に付き、flat には枠線が無いので、選んだ調だけ上下左右 1px 小さく見える。
   選んだ調にも透明な枠線 1px を付けて、同じ大きさにそろえる(背景は枠線の下まで塗られる) */
.hymn-detail__key.v-chip--variant-flat {
  border: 1px solid transparent;
}
.hymn-detail__staff {
  margin-top: 8px;
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

/* ===== モバイル(compact) ===== */
.hymn-detail--compact {
  padding: 4px 16px 0;
  border: 0;
  border-radius: 0 !important;
}
.hymn-detail--compact .hymn-detail__head {
  flex-direction: column;
  gap: 12px;
}
.hymn-detail--compact .hymn-detail__title {
  font-size: 1.5rem;
}
.hymn-detail--compact .hymn-detail__kr {
  font-size: 1.0625rem;
}
.hymn-detail--compact .hymn-detail__keys {
  gap: 6px 10px;
}
/* 五線譜は幅に合わせて縮め、調の名前は五線譜の下へ回す */
.hymn-detail--compact .hymn-detail__staff {
  flex-wrap: wrap;
  gap: 4px 18px;
  max-width: 100%;
}
.hymn-detail--compact .hymn-detail__staff :deep(svg) {
  width: min(300px, 100%);
  height: auto;
}
.hymn-detail--compact .hymn-detail__lyric {
  font-size: 1.0625rem;
  line-height: 2;
}
</style>
