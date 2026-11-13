<script setup lang="ts">
// 楽譜アイコンの「調を選ぶふきだし」(旧 components/ScoreKeyPopover.tsx)。
// 楽譜が1件(以下)ならそのままダウンロード、複数あるときはアイコンの横にふきだしを出し、
// 調を選んでダウンロードする。オリジナルキーは「A♭*」のように星を付ける。
// ふきだしは v-menu(body へ teleport)なので、テーブル等の overflow:hidden に切られない。
// トリガーは非同期で調を取得してから開く必要があるため、v-menu のクリック開閉は使わず
// open を自分で持ち、位置合わせ用のアイコン要素(anchorRef)を activator に渡す。
//
// 使い方:
//   <ScoreKeyPopover :id :fetch-keys :download v-slot="{ onClick, loading, open, anchorRef }">
//     <v-btn :ref="anchorRef" :loading :aria-expanded="open" @click="onClick" />
//   </ScoreKeyPopover>
import { computed, ref, type ComponentPublicInstance } from "vue";
import { chordLabel, type ScoreKey } from "@/lib/scoreKeys";

const props = withDefaults(
  defineProps<{
    id: string;
    /** 調の一覧を取得する(失敗時は null を返す。エラー表示は呼び出し側) */
    fetchKeys: (id: string) => Promise<ScoreKey[] | null>;
    /** ダウンロードする。chord 省略時はサーバーがオリジナルキー優先で1件選ぶ */
    download: (id: string, chord?: string) => Promise<void>;
    side?: "top" | "right" | "bottom" | "left";
    contentClass?: string;
    itemClass?: string;
  }>(),
  { side: "right" },
);

defineSlots<{
  default(slotProps: {
    /** アイコンの click に渡す */
    onClick: (e: MouseEvent) => void;
    /** 調の一覧を取得中 */
    loading: boolean;
    /** ふきだしが開いているか */
    open: boolean;
    /** アイコン要素の :ref に渡す(ふきだしの位置合わせ用) */
    anchorRef: (el: Element | ComponentPublicInstance | null) => void;
  }): unknown;
}>();

const open = ref(false);
const keys = ref<ScoreKey[]>([]);
const loading = ref(false);
const anchorEl = ref<Element | null>(null);

const anchorRef = (el: Element | ComponentPublicInstance | null) => {
  anchorEl.value =
    el && "$el" in el ? (el.$el as Element) : (el as Element | null);
};

const location = computed(
  () =>
    (({ right: "end", left: "start", top: "top", bottom: "bottom" }) as const)[
      props.side
    ],
);

const onClick = async (e: MouseEvent) => {
  e.preventDefault();
  if (loading.value) return;
  loading.value = true;
  try {
    const list = await props.fetchKeys(props.id);
    if (list === null) return; // 取得失敗(エラー表示済み)
    if (list.length > 1) {
      keys.value = list;
      open.value = true;
    } else {
      await props.download(props.id); // 0件・1件: 今まで通り直接ダウンロード
    }
  } finally {
    loading.value = false;
  }
};

const onSelect = (chord: string) => {
  open.value = false;
  void props.download(props.id, chord);
};
</script>

<template>
  <slot
    :on-click="onClick"
    :loading="loading"
    :open="open"
    :anchor-ref="anchorRef"
  />
  <v-menu
    v-model="open"
    :activator="anchorEl ?? undefined"
    :open-on-click="false"
    :location="location"
    offset="10"
  >
    <v-list
      role="menu"
      density="compact"
      rounded="xl"
      :class="['noto-serif score-key-popover', contentClass]"
    >
      <v-list-item
        v-for="k in keys"
        :key="k.chord"
        role="menuitem"
        rounded="lg"
        color="primary"
        :class="['text-center', itemClass]"
        @click="onSelect(k.chord)"
      >
        {{ chordLabel(k.chord) }}{{ k.isOriginal ? "*" : "" }}
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<style scoped>
.score-key-popover {
  min-width: 80px;
  padding: 6px;
  color: #374151;
}
</style>
