<script setup lang="ts">
// 歌詞の本文(LyricViewer の中身)。検索した語に一致する部分をハイライトする。
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import Highlighted from "@/components/Highlighted.vue";
import { countHits, lyricQueryOptions } from "@/lib/lyrics";
import { extractErrorMessage } from "@/lib/constants";

const props = defineProps<{ id: string; terms: string[] }>();

const { data, isPending, error } = useQuery(computed(() => lyricQueryOptions(props.id)));

const hits = computed(() => (data.value ? countHits(data.value, props.terms) : 0));
const termsLabel = computed(() => props.terms.join("・"));
</script>

<template>
  <div v-if="isPending" class="d-flex justify-center py-10">
    <v-progress-circular indeterminate size="24" width="2" />
  </div>
  <p v-else-if="error" class="py-6 text-center">
    {{ extractErrorMessage(error, "歌詞の取得に失敗しました") }}
  </p>
  <p v-else-if="!data" class="py-6 text-center lyric-body__muted">歌詞が登録されていません。</p>
  <template v-else>
    <p v-if="terms.length > 0" class="text-caption lyric-body__muted" aria-live="polite">
      {{
        hits > 0
          ? `「${termsLabel}」に一致: ${hits}箇所`
          : `「${termsLabel}」は歌詞に含まれていません(歌詞が似ている曲として表示)`
      }}
    </p>
    <div class="lyric-text noto-serif">
      <Highlighted :text="data" :terms="terms" />
    </div>
  </template>
</template>

<style scoped>
.lyric-body__muted {
  opacity: 0.85;
}
</style>
