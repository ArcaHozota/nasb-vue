// src/composables/useDebouncedValue.ts
// 値が delayMs のあいだ変わらなかったら、その値を返す(入力のたびにAPIを叩かないため)。
// 旧 hooks/use-debounced-value.ts 相当。ref / getter を受けて読み取り専用の ref を返す。
import {
  readonly,
  ref,
  toValue,
  watch,
  type DeepReadonly,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

export function useDebouncedValue<T>(
  source: MaybeRefOrGetter<T>,
  delayMs: MaybeRefOrGetter<number>,
): Readonly<Ref<DeepReadonly<T>>> {
  const debounced = ref(toValue(source)) as Ref<T>;
  watch(
    () => [toValue(source), toValue(delayMs)] as const,
    ([value, delay], _old, onCleanup) => {
      const timer = setTimeout(() => {
        debounced.value = value;
      }, delay);
      onCleanup(() => clearTimeout(timer));
    },
  );
  return readonly(debounced);
}
