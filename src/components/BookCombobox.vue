<script setup lang="ts">
// 検索付きの書セレクト(旧 components/BookCombobox.tsx = Popover + Command)。
// 聖書66巻をスクロールせず、「ヨハネ」「創」など名前の一部を打ち込んで絞り込める。
// v-autocomplete は日本語IMEの変換中の Enter でも候補を選んでしまうため、
// 変換中(isComposing)の Enter は v-autocomplete に届く前に止める。
type BookOption = { id: number | string; name: string };

defineProps<{
  id?: string;
  books: BookOption[];
}>();
const model = defineModel<number | string>({ required: true });

// 開いたときは選択中の書名を全選択し、打ち込んだ文字で置き換えて絞り込めるようにする
// (旧 Command は空の検索欄から始まっていた。後ろに足されると「該当なし」になるため)
const selectAllOnFocus = (e: FocusEvent) => {
  const input = e.target;
  if (input instanceof HTMLInputElement) requestAnimationFrame(() => input.select());
};

const stopWhileComposing = (e: KeyboardEvent) => {
  if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) e.stopPropagation();
};
</script>

<template>
  <div @focusin="selectAllOnFocus">
    <v-autocomplete
      :id="id"
      v-model="model"
      :items="books"
      item-title="name"
      item-value="id"
      placeholder="書を選択"
      no-data-text="該当する書がありません"
      :disabled="books.length === 0"
      variant="outlined"
      density="compact"
      color="primary"
      menu-icon="mdi-unfold-more-horizontal"
      hide-details
      auto-select-first
      :menu-props="{ maxHeight: 288 }"
      @keydown.capture="stopWhileComposing"
    />
  </div>
</template>
