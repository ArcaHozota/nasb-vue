<script setup lang="ts">
// 最大2行で「…」省略するテキスト(旧 components/ClampText.tsx)。
// 実際に省略されている時だけ、ホバーで全文をツールチップ表示する
// (省略されていない短い名称にまでツールチップが出るとうるさいため)。
import { ref } from "vue";

defineProps<{ text: string }>();

const el = ref<HTMLElement | null>(null);
const open = ref(false);

// 開こうとした時だけ、はみ出しているか(=省略されているか)を測る
const onUpdate = (next: boolean) => {
  open.value = next && !!el.value && el.value.scrollHeight > el.value.clientHeight + 1;
};
</script>

<template>
  <span ref="el" class="line-clamp-2">
    {{ text }}
    <v-tooltip
      :model-value="open"
      activator="parent"
      max-width="384"
      :text="text"
      @update:model-value="onUpdate"
    />
  </span>
</template>
