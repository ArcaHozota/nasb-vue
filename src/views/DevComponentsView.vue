<script setup lang="ts">
// 【一時的・開発用】フェーズ4の共通コンポーネントの動作確認ページ。フェーズ5で各画面に組み込んだら削除する。
import { ref } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import Highlighted from "@/components/Highlighted.vue";
import ClampText from "@/components/ClampText.vue";
import Hint from "@/components/Hint.vue";
import ScoreKeyPopover from "@/components/ScoreKeyPopover.vue";
import ScoreKeyDialog from "@/components/ScoreKeyDialog.vue";
import KeyStaff from "@/components/home/KeyStaff.vue";
import LyricViewer, { type LyricTarget } from "@/components/LyricViewer.vue";
import BookCombobox from "@/components/BookCombobox.vue";
import RedLetterEditor from "@/components/RedLetterEditor.vue";
import HymnFormModal from "@/components/HymnFormModal.vue";
import HymnScoreModal from "@/components/HymnScoreModal.vue";
import { fetchScoreKeysOrToast } from "@/lib/scoreKeys";
import { useFeedbackStore } from "@/stores/feedback";

const queryClient = useQueryClient();
const feedback = useFeedbackStore();
const fakeDownload = async (id: string, chord?: string) =>
  feedback.toast(`ダウンロード: ${id} ${chord ?? "(既定)"}`);

const keyDialog = ref(false);
const lyric = ref<LyricTarget | null>(null);
const lyricVariant = ref<"sheet" | "dialog">("dialog");
const book = ref<number | string>(43);
const books = [
  { id: 1, name: "創世記" },
  { id: 2, name: "出エジプト記" },
  { id: 43, name: "ヨハネの福音書" },
  { id: 62, name: "ヨハネの手紙第一" },
];
const red = ref("イエスは言われた。{{わたしが道であり、真理であり、いのちなのです。}}");
const editor = ref<InstanceType<typeof RedLetterEditor> | null>(null);
const form = ref<"add" | "edit" | null>(null);
const score = ref(false);
</script>

<template>
  <v-container class="d-flex flex-column ga-6 py-6" max-width="900">
    <section>
      <h3>Highlighted / ClampText / Hint</h3>
      <p><Highlighted text="주 하나님 지으신 모든 세계" :terms="['하나님', '세계']" /></p>
      <div style="width: 160px"><ClampText text="とても長い賛美歌の名前がここに入ります。三行以上になるので省略されます。" /></div>
      <Hint label="ヒントです" v-slot="{ props }"><v-btn v-bind="props">Hint</v-btn></Hint>
      <Hint label="無効でも出ます" wrap-disabled v-slot="{ props }"><v-btn v-bind="props" disabled>disabled</v-btn></Hint>
    </section>

    <section class="d-flex align-center ga-4">
      <h3>ScoreKeyPopover / Dialog</h3>
      <ScoreKeyPopover
        id="1"
        :fetch-keys="(id) => fetchScoreKeysOrToast(queryClient, id)"
        :download="fakeDownload"
        v-slot="{ onClick, loading, open, anchorRef }"
      >
        <v-btn :ref="anchorRef" icon="mdi-file-download-outline" variant="outlined" size="small"
          :loading="loading" aria-haspopup="menu" :aria-expanded="open" @click="onClick" />
      </ScoreKeyPopover>
      <v-btn @click="keyDialog = true">調ダイアログ</v-btn>
      <ScoreKeyDialog v-model="keyDialog" title="輝く日を仰ぐとき"
        :keys="[{ chord: 'Ab', isOriginal: true }, { chord: 'G', isOriginal: false }]"
        @select="(c) => fakeDownload('1', c)" />
    </section>

    <section class="open-hymnal">
      <h3>KeyStaff</h3>
      <KeyStaff chord="Ab" :is-original="true" state="ready" @download="fakeDownload('1', 'Ab')" />
      <KeyStaff chord="D" :is-original="false" state="downloading" />
      <KeyStaff :chord="null" :is-original="false" state="empty" />
    </section>

    <section class="d-flex ga-2">
      <h3>LyricViewer</h3>
      <v-btn @click="lyricVariant = 'dialog'; lyric = { id: '1', nameJp: '輝く日を仰ぐとき', nameKr: '주 하나님 지으신 모든 세계', lineNumber: 'BURGUNDY' }">dialog</v-btn>
      <v-btn @click="lyricVariant = 'sheet'; lyric = { id: '1', nameJp: '輝く日を仰ぐとき', nameKr: '주 하나님 지으신 모든 세계', lineNumber: 'BURGUNDY' }">sheet</v-btn>
      <LyricViewer :target="lyric" :terms="['하나님']" :variant="lyricVariant" @close="lyric = null" />
    </section>

    <section style="max-width: 320px">
      <h3>BookCombobox: {{ book }}</h3>
      <BookCombobox v-model="book" :books="books" />
    </section>

    <section>
      <h3>RedLetterEditor</h3>
      <RedLetterEditor ref="editor" v-model="red" placeholder="本文" helper-text="選択して赤字ボタン" />
      <v-btn class="mt-2" @mousedown.prevent @click="editor?.wrapSelection()">赤字</v-btn>
      <pre class="text-caption">{{ red }}</pre>
    </section>

    <section class="d-flex ga-2">
      <h3>Modals</h3>
      <v-btn @click="form = 'add'">追加</v-btn>
      <v-btn @click="form = 'edit'">編集</v-btn>
      <v-btn @click="score = true">楽譜</v-btn>
      <HymnFormModal v-if="form" :mode="form" edit-id="1" :page-size="5"
        @close="form = null" @saved="(r) => { feedback.toast(JSON.stringify(r)); form = null; }" />
      <HymnScoreModal v-if="score" hymn-id="1" hymn-name-kr="주 하나님 지으신 모든 세계"
        @close="score = false" @uploaded="feedback.toast('uploaded')" />
    </section>
  </v-container>
</template>
