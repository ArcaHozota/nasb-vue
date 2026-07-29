<script setup lang="ts">
// src/views/HymnForm.vue
// 旧 views/HymnForm.tsx を移植(追加・編集の両方で使用)
import { reactive, ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { useAuthStore } from "@/stores/auth";
import { EMPTY_STRING, extractErrorMessage } from "@/constants";
import bgImage from "@/assets/mainmenu-bg5.webp";

type FormState = {
  id: string | null;
  nameJp: string;
  nameKr: string;
  link: string;
  lyric: string;
  classic: boolean;
  updatedTime: string;
  updatedUser: string;
};

const emptyForm: FormState = {
  id: null,
  nameJp: EMPTY_STRING,
  nameKr: EMPTY_STRING,
  link: EMPTY_STRING,
  lyric: EMPTY_STRING,
  classic: false,
  updatedTime: EMPTY_STRING,
  updatedUser: EMPTY_STRING,
};

const required = (v: string) =>
  !!v && v.trim() !== EMPTY_STRING
    ? EMPTY_STRING
    : "上記の入力ボックスを空になってはいけません。";

const route = useRoute();
const router = useRouter();
const feedback = useFeedbackStore();
const auth = useAuthStore();

const asStr = (v: unknown) => (typeof v === "string" ? v : EMPTY_STRING);

const editId = asStr(route.query.editId) || null;
const isEdit = !!editId;
const pageNum = asStr(route.query.pageNum);
const pageSize = asStr(route.query.pageSize);
const keyword = asStr(route.query.keyword);

const form = reactive<FormState>({ ...emptyForm, id: editId });
const errors = reactive({
  nameJp: EMPTY_STRING,
  nameKr: EMPTY_STRING,
  link: EMPTY_STRING,
  lyric: EMPTY_STRING,
});
const saving = ref(false);
const originalForm = ref<FormState | null>(null);

// 編集時: 既存データをロード
onMounted(async () => {
  if (!isEdit) return;
  try {
    const { data } = await api.get("/hymns/get-info-id", {
      params: { hymnId: editId },
    });
    Object.assign(form, data);
    originalForm.value = { ...form, ...data };
  } catch (e) {
    feedback.toast(extractErrorMessage(e, "データの取得に失敗しました"));
  }
});

const checkNameJp = async (e: FocusEvent) => {
  const name = (e.target as HTMLInputElement).value.trim();
  errors.nameJp = EMPTY_STRING;
  if (!name) return;
  try {
    await api.get("/hymns/check-duplicated", {
      params: { id: form.id ?? EMPTY_STRING, nameJp: name },
    });
  } catch (e) {
    errors.nameJp = extractErrorMessage(e, "この名称は既に使われています。");
  }
};

const checkNameKr = async (e: FocusEvent) => {
  const name = (e.target as HTMLInputElement).value.trim().normalize("NFC");
  errors.nameKr = EMPTY_STRING;
  if (!name) return;
  try {
    await api.get("/hymns/check-duplicated2", {
      params: { id: form.id ?? EMPTY_STRING, nameKr: name },
    });
  } catch (e) {
    errors.nameKr = extractErrorMessage(e, "この名称は既に使われています。");
  }
};

const buildListQuery = () => {
  const qs = new URLSearchParams();
  if (pageNum) qs.set("pageNum", pageNum);
  if (pageSize) qs.set("pageSize", pageSize);
  if (keyword) qs.set("keyword", keyword);
  return qs.toString();
};

const onSubmit = async () => {
  const nextErrors = {
    nameJp: required(form.nameJp) || errors.nameJp,
    nameKr: required(form.nameKr) || errors.nameKr,
    link: required(form.link),
    lyric: required(form.lyric),
  };
  Object.assign(errors, nextErrors);
  if (Object.values(nextErrors).some(Boolean)) {
    feedback.toast("入力情報不正");
    return;
  }
  const uid = auth.userId;
  if (!uid) {
    feedback.toast("ログイン情報の取得に失敗しました。再度ログインしてください。");
    return;
  }
  saving.value = true;
  const payload = {
    nameJp: form.nameJp.trim(),
    nameKr: form.nameKr.trim().normalize("NFC"),
    link: form.link,
    lyric: form.lyric,
    classic: form.classic,
    updatedUser: uid,
  };
  try {
    if (isEdit) {
      const updatePayload = {
        ...payload,
        id: form.id,
        updatedTime: form.updatedTime,
      };
      const { data } = await api.put("/hymns/info-update", updatePayload);
      feedback.toast(typeof data === "string" ? data : "更新しました");
      router.push(`/hymns?${buildListQuery()}`);
    } else {
      const { data } = await api.post("/hymns/info-storage", payload, {
        params: { pageSize: pageSize || 5 },
      });
      feedback.toast("追加済み");
      const qs = new URLSearchParams();
      qs.set("pageNum", data);
      if (pageSize) qs.set("pageSize", pageSize);
      router.push(`/hymns?${qs.toString()}`);
    }
  } catch (e) {
    feedback.toast(extractErrorMessage(e, "保存に失敗しました"));
  } finally {
    saving.value = false;
  }
};

const onReset = () => {
  if (isEdit && originalForm.value) {
    Object.assign(form, originalForm.value);
  } else {
    Object.assign(form, { ...emptyForm, id: editId });
  }
  Object.assign(errors, {
    nameJp: EMPTY_STRING,
    nameKr: EMPTY_STRING,
    link: EMPTY_STRING,
    lyric: EMPTY_STRING,
  });
};

const listQueryStr = computed(() => buildListQuery());
</script>

<template>
  <div
    class="noto-sans relative -m-6 min-h-[calc(100vh-48px)] bg-cover bg-center bg-fixed p-4"
  >
    <div class="fixed inset-0 -z-10">
      <img :src="bgImage" alt="" class="h-full w-full object-cover" />
    </div>

    <!-- パンくずリスト -->
    <nav class="mb-2 text-sm font-semibold text-[#fffff0]">
      <RouterLink to="/mainmenu" class="hover:underline">メインメニュー</RouterLink>
      <span class="mx-1">/</span>
      <RouterLink :to="`/hymns?${listQueryStr}`" class="hover:underline">データリスト</RouterLink>
      <span class="mx-1">/</span>
      <span>{{ isEdit ? "データ更新" : "データ追加" }}</span>
    </nav>

    <div class="form-card relative overflow-hidden rounded-[18px]" :class="{ 'is-edit': isEdit }">
      <div
        class="flex items-center px-4 py-3 text-white"
        :class="isEdit ? 'bg-primary' : 'bg-success'"
      >
        <span class="mr-2">▦</span>
        <h1 class="text-lg font-semibold">
          {{ isEdit ? "賛美歌情報更新" : "賛美歌情報追加" }}
        </h1>
      </div>

      <div class="p-6 pt-5">
        <div class="mb-5">
          <div class="form-label">日本語名称</div>
          <input
            v-model="form.nameJp"
            type="text"
            placeholder="日本語名称を入力してください"
            class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
            :class="errors.nameJp ? 'border-red-400' : 'border-gray-300 focus:border-primary'"
            @blur="checkNameJp"
          />
          <p v-if="errors.nameJp" class="mt-1 text-xs text-red-600">{{ errors.nameJp }}</p>
        </div>

        <div class="mb-5">
          <div class="form-label">韓国語名称</div>
          <input
            v-model="form.nameKr"
            type="text"
            placeholder="韓国語名称を入力してください"
            class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
            :class="errors.nameKr ? 'border-red-400' : 'border-gray-300 focus:border-primary'"
            @blur="checkNameKr"
          />
          <p v-if="errors.nameKr" class="mt-1 text-xs text-red-600">{{ errors.nameKr }}</p>
        </div>

        <div class="link-row mb-5">
          <div class="link-field">
            <div class="form-label">リンク</div>
            <input
              v-model="form.link"
              type="text"
              placeholder="リンクを入力してください"
              class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
              :class="errors.link ? 'border-red-400' : 'border-gray-300 focus:border-primary'"
            />
            <p v-if="errors.link" class="mt-1 text-xs text-red-600">{{ errors.link }}</p>
          </div>
          <div class="classic-field">
            <div class="form-label">クラシック</div>
            <input v-model="form.classic" type="checkbox" class="h-5 w-5 accent-primary" />
          </div>
        </div>

        <div class="mb-5">
          <div class="form-label">歌詞</div>
          <textarea
            v-model="form.lyric"
            rows="6"
            placeholder="セリフを入力してください"
            class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
            :class="errors.lyric ? 'border-red-400' : 'border-gray-300 focus:border-primary'"
          />
          <p v-if="errors.lyric" class="mt-1 text-xs text-red-600">{{ errors.lyric }}</p>
        </div>

        <p v-if="isEdit" class="text-xs text-gray-500">
          最終更新者：{{ form.updatedUser }}＠{{ form.updatedTime }}日本標準時間
        </p>
      </div>

      <div class="flex justify-end gap-2 px-6 pb-4">
        <button
          type="button"
          class="rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          :class="isEdit ? 'bg-primary' : 'bg-success'"
          :disabled="saving"
          @click="onSubmit"
        >
          <span v-if="saving" class="inline-block animate-spin">⟳</span>
          <span v-else>{{ isEdit ? "更新" : "追加" }}</span>
        </button>
        <button
          type="button"
          class="rounded-md bg-gray-500 px-4 py-1.5 text-sm font-medium text-white"
          @click="onReset"
        >
          {{ isEdit ? "廃棄" : "リセット" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.noto-sans,
.noto-sans * {
  font-family: "Noto Sans JP", sans-serif !important;
}

.form-card {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.45);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.form-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #006400 320deg,
    #4caf50 350deg,
    #006400 360deg
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.form-card.is-edit::before {
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #800020 320deg,
    #c0405f 350deg,
    #800020 360deg
  );
}

.form-card:hover::before {
  opacity: 1;
  animation: rotate-border 3300ms linear infinite;
}

@keyframes rotate-border {
  to {
    --angle: 360deg;
  }
}

.form-label {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 6px;
}

.link-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.link-field {
  flex: 1;
  min-width: 0;
}

.classic-field {
  flex-shrink: 0;
  width: 96px;
}
</style>
