<script setup lang="ts">
// v-tooltip を1行で付けるための薄いラッパー(旧 components/Hint.tsx、旧 title 属性の置き換え)。
//   <Hint label="プレイリスト作成" v-slot="{ props }"><v-btn v-bind="props" …/></Hint>
// 無効(disabled)なボタンはポインタイベントが発生せずツールチップが出ないため、
// その場合は wrapDisabled で span に包んで、そちらをトリガーにする。
withDefaults(
  defineProps<{
    label: string;
    location?: "top" | "end" | "bottom" | "start";
    /** 子が disabled になり得るボタンの場合 true(span で包んでホバーを受け取る) */
    wrapDisabled?: boolean;
    /** span で包む時の class(レイアウト調整用) */
    wrapperClass?: string;
  }>(),
  { location: "top", wrapDisabled: false, wrapperClass: "d-inline-flex" },
);
</script>

<template>
  <v-tooltip :text="label" :location="location">
    <template #activator="{ props: activatorProps }">
      <span v-if="wrapDisabled" v-bind="activatorProps" :class="wrapperClass">
        <slot :props="{}" />
      </span>
      <slot v-else :props="activatorProps" />
    </template>
  </v-tooltip>
</template>
