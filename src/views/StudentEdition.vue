<script setup lang="ts">
// src/views/StudentEdition.vue
// 旧 views/StudentEdition.tsx を移植
import { reactive, ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IdCard,
  Eye,
  EyeOff,
  Zap,
  Trash2,
  LoaderCircle,
  Youtube,
} from "@lucide/vue";
import api from "@/api/axios";
import { useFeedbackStore } from "@/stores/feedback";
import { EMPTY_STRING, extractErrorMessage } from "@/constants";
import bgImage from "@/assets/mainmenu-bg4.webp";

type StudentForm = {
  id: string | null;
  loginAccount: string;
  username: string;
  password: string;
  dateOfBirth: string;
  email: string;
};

const emptyForm: StudentForm = {
  id: null,
  loginAccount: EMPTY_STRING,
  username: EMPTY_STRING,
  password: EMPTY_STRING,
  dateOfBirth: EMPTY_STRING,
  email: EMPTY_STRING,
};

const required = (v: string) =>
  !!v && v.trim() !== EMPTY_STRING
    ? EMPTY_STRING
    : "上記の入力ボックスを空になってはいけません。";

const toDateInputValue = (src: string) => {
  if (!src) return EMPTY_STRING;
  if (/^\d{4}-\d{2}-\d{2}$/.test(src)) return src;
  const d = new Date(src);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const route = useRoute();
const router = useRouter();
const feedback = useFeedbackStore();

const asStr = (v: unknown) => (typeof v === "string" ? v : EMPTY_STRING);
const userId = asStr(route.query.userId) || null;

const form = reactive<StudentForm>({ ...emptyForm, id: userId });
const errors = reactive({
  loginAccount: EMPTY_STRING,
  username: EMPTY_STRING,
  password: EMPTY_STRING,
  dateOfBirth: EMPTY_STRING,
  email: EMPTY_STRING,
});
const saving = ref(false);
const showPassword = ref(false);

// ===== YouTube連携 =====
// youtubeEnabled: トグルの見た目そのもの(連携ボタン行の表示/非表示を切り替えるだけ)
// youtubeLinked / youtubeAccountName: 実際の連携状態(APIから取得)
const youtubeEnabled = ref(false);
const youtubeLinked = ref(false);
const youtubeAccountName = ref(EMPTY_STRING);
const youtubeLoading = ref(false);

const fetchYoutubeStatus = async () => {
  try {
    const { data } = await api.get("/youtube/status");
    youtubeLinked.value = !!data.linked;
    youtubeAccountName.value = data.accountName ?? EMPTY_STRING;
    // 既に連携済みなら、初期状態からボタンが見えているのが自然
    youtubeEnabled.value = youtubeLinked.value;
  } catch {
    // 未実装/未連携の場合も含め、取得失敗時は「未連携」扱いにしておく
    youtubeLinked.value = false;
    youtubeAccountName.value = EMPTY_STRING;
  }
};

const onToggleYoutubeSection = () => {
  youtubeEnabled.value = !youtubeEnabled.value;
};

const onYoutubeButtonClick = async () => {
  if (youtubeLoading.value) return;

  if (!youtubeLinked.value) {
    // OAuth同意画面へはブラウザレベルの遷移が必要なので、axios経由ではなく
    // フルナビゲーションで開始する。連携完了後はサーバー側が
    // /personal?youtubeLinked=true へリダイレクトしてくる想定。
    window.location.href = "/api/youtube/authorize";
    return;
  }

  const ok = await feedback.confirm(
    "YouTube連携を解除してよろしいでしょうか。",
    "確認",
  );
  if (!ok) return;

  youtubeLoading.value = true;
  try {
    await api.post("/youtube/unlink");
    youtubeLinked.value = false;
    youtubeAccountName.value = EMPTY_STRING;
    feedback.toast("YouTube連携を解除しました");
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "連携解除に失敗しました"));
  } finally {
    youtubeLoading.value = false;
  }
};

const fetchInitial = async () => {
  if (!form.id) return;
  try {
    const { data } = await api.get(`/students/${form.id}`);
    form.loginAccount = data.loginAccount;
    form.username = data.username;
    form.password = data.password;
    form.dateOfBirth = toDateInputValue(data.dateOfBirth);
    form.email = data.email;
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "データの取得に失敗しました"));
  }
};

onMounted(() => {
  fetchInitial();
  fetchYoutubeStatus();

  // OAuth連携完了後のコールバック(/personal?youtubeLinked=true)からの帰還を検知
  if (route.query.youtubeLinked === "true") {
    feedback.toast("YouTubeと連携しました");
    router.replace({ query: {} });
  }
});

const checkAccount = async () => {
  errors.loginAccount = EMPTY_STRING;
  const name = form.loginAccount.trim();
  if (!name) return;
  try {
    await api.get("/students/duplicate-check", {
      params: { id: form.id ?? EMPTY_STRING, loginAccount: name },
    });
  } catch (e: unknown) {
    errors.loginAccount = extractErrorMessage(
      e,
      "このアカウントは既に使われています。",
    );
  }
};

const onUpdate = async () => {
  const nextErrors = {
    loginAccount: required(form.loginAccount) || errors.loginAccount,
    username: required(form.username),
    password: required(form.password),
    dateOfBirth: required(form.dateOfBirth),
    email: required(form.email),
  };
  Object.assign(errors, nextErrors);
  if (Object.values(nextErrors).some(Boolean)) {
    feedback.toast("入力情報不正");
    return;
  }
  saving.value = true;
  try {
    const { data } = await api.put(`/students/${form.id}`, {
      id: form.id,
      loginAccount: form.loginAccount.trim(),
      username: form.username.trim(),
      password: form.password,
      email: form.email,
      dateOfBirth: form.dateOfBirth,
    });
    feedback.toast(typeof data === "string" ? data : "更新しました");
    router.push("/mainmenu");
  } catch (e: unknown) {
    feedback.toast(extractErrorMessage(e, "更新に失敗しました"));
  } finally {
    saving.value = false;
  }
};

const onRestore = async () => {
  Object.assign(errors, {
    loginAccount: EMPTY_STRING,
    username: EMPTY_STRING,
    password: EMPTY_STRING,
    dateOfBirth: EMPTY_STRING,
    email: EMPTY_STRING,
  });
  if (!form.id) {
    Object.assign(form, { ...emptyForm });
    return;
  }
  await fetchInitial();
};
</script>

<template>
  <div class="noto-sans relative min-h-full bg-cover bg-center bg-fixed">
    <div class="fixed inset-0 -z-10">
      <img :src="bgImage" alt="" class="h-full w-full object-cover" />
    </div>

    <nav class="mb-2 text-sm font-semibold text-[#fffff0]">
      <RouterLink to="/mainmenu" class="hover:underline"
        >メインメニュー</RouterLink
      >
      <span class="mx-1">/</span>
      <span>データリスト</span>
      <span class="mx-1">/</span>
      <span>データ更新</span>
    </nav>

    <div class="studentedition-card relative overflow-hidden rounded-[18px]">
      <div
        class="flex items-center px-4 py-3 text-white"
        style="background-color: #ff883e"
      >
        <IdCard class="mr-2 h-5 w-5" />
        <h1 class="text-lg font-semibold">ユーザー情報更新</h1>
      </div>

      <div class="p-6 pt-5">
        <div class="mb-5">
          <div class="form-label">アカウント</div>
          <input
            v-model="form.loginAccount"
            type="text"
            placeholder="アカウントを入力してください"
            class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
            :class="
              errors.loginAccount
                ? 'border-red-400'
                : 'border-gray-300 focus:border-primary'
            "
            @blur="checkAccount"
          />
          <p v-if="errors.loginAccount" class="mt-1 text-xs text-red-600">
            {{ errors.loginAccount }}
          </p>
        </div>

        <div class="mb-5">
          <div class="form-label">名称</div>
          <input
            v-model="form.username"
            type="text"
            placeholder="名称を入力してください"
            class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
            :class="
              errors.username
                ? 'border-red-400'
                : 'border-gray-300 focus:border-primary'
            "
          />
          <p v-if="errors.username" class="mt-1 text-xs text-red-600">
            {{ errors.username }}
          </p>
        </div>

        <div class="mb-5 flex gap-4">
          <div class="flex-1">
            <div class="form-label">パスワード</div>
            <div class="relative">
              <input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="パスワードを入力してください"
                class="w-full rounded-md border px-3 py-1.5 pr-9 text-sm outline-none"
                :class="
                  errors.password
                    ? 'border-red-400'
                    : 'border-gray-300 focus:border-primary'
                "
              />
              <button
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </button>
            </div>
            <p v-if="errors.password" class="mt-1 text-xs text-red-600">
              {{ errors.password }}
            </p>
          </div>

          <div class="flex-1">
            <div class="form-label">メール</div>
            <input
              v-model="form.email"
              type="text"
              placeholder="メールを入力してください"
              class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
              :class="
                errors.email
                  ? 'border-red-400'
                  : 'border-gray-300 focus:border-primary'
              "
            />
            <p v-if="errors.email" class="mt-1 text-xs text-red-600">
              {{ errors.email }}
            </p>
          </div>
        </div>

        <div class="mb-2 flex items-end gap-4">
          <div class="w-3/5">
            <div class="form-label">生年月日</div>
            <input
              v-model="form.dateOfBirth"
              type="date"
              class="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
              :class="
                errors.dateOfBirth
                  ? 'border-red-400'
                  : 'border-gray-300 focus:border-primary'
              "
            />
            <p v-if="errors.dateOfBirth" class="mt-1 text-xs text-red-600">
              {{ errors.dateOfBirth }}
            </p>
          </div>

          <div
            class="flex flex-1 items-center justify-between rounded-md border border-gray-300 px-3 py-[7px]"
          >
            <span
              class="flex items-center gap-1.5 text-sm font-medium text-gray-700"
            >
              <Youtube class="h-4 w-4 text-red-600" /> YouTube連携
            </span>
            <button
              type="button"
              role="switch"
              :aria-checked="youtubeEnabled"
              class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
              :class="youtubeEnabled ? 'bg-primary' : 'bg-gray-300'"
              @click="onToggleYoutubeSection"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                :class="youtubeEnabled ? 'translate-x-4' : 'translate-x-0.5'"
              />
            </button>
          </div>
        </div>

        <div v-if="youtubeEnabled" class="mb-2 flex justify-end">
          <button
            type="button"
            :disabled="youtubeLoading"
            class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
            :class="
              youtubeLinked
                ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            "
            :title="
              youtubeLinked ? 'クリックで連携解除' : 'クリックでYouTubeと連携'
            "
            @click="onYoutubeButtonClick"
          >
            <Youtube class="h-4 w-4 text-red-600" />
            <template v-if="youtubeLinked">
              <span>{{ youtubeAccountName }}</span>
              <span class="text-xs font-normal text-green-600">連携済み</span>
            </template>
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2 px-6 pb-4">
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          :disabled="saving"
          @click="onUpdate"
        >
          <LoaderCircle
            v-if="saving"
            class="inline-block h-4 w-4 animate-spin"
          />
          <span v-else class="flex items-center justify-center gap-1"
            ><Zap class="h-4 w-4" /> 更新</span
          >
        </button>
        <button
          type="button"
          class="flex items-center gap-1 rounded-md bg-gray-500 px-4 py-1.5 text-sm font-medium text-white"
          @click="onRestore"
        >
          <Trash2 class="h-4 w-4" /> 廃棄
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

.studentedition-card {
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

.studentedition-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(
    from var(--angle),
    transparent 0deg,
    transparent 270deg,
    #b8860b 320deg,
    #f6c91c 350deg,
    #b8860b 360deg
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

.studentedition-card:hover::before {
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
</style>
