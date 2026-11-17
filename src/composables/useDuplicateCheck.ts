import {
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import axios from "axios";
import { extractMessage } from "@/lib/constants";

/** 入力が変わったら以前の検査を無効にし、最新の値の結果だけを返す。 */
export function useDuplicateCheck(options: {
  value: MaybeRefOrGetter<string>;
  request: (value: string, signal: AbortSignal) => Promise<unknown>;
  duplicateMessage: string;
  failureMessage: string;
}) {
  const error = ref("");
  const checking = ref(false);
  let version = 0;
  let controller: AbortController | undefined;
  let pending: Promise<boolean> | undefined;

  const reset = () => {
    version++;
    controller?.abort();
    controller = undefined;
    pending = undefined;
    error.value = "";
    checking.value = false;
  };
  watch(() => toValue(options.value), reset, { flush: "sync" });
  onScopeDispose(reset);

  const check = (): Promise<boolean> => {
    const value = toValue(options.value);
    if (!value) {
      reset();
      return Promise.resolve(true);
    }
    if (pending) return pending;
    const current = ++version;
    const abort = new AbortController();
    controller = abort;
    checking.value = true;
    error.value = "";
    pending = (async () => {
      try {
        await Promise.resolve().then(() =>
          options.request(value, abort.signal),
        );
        return current === version && value === toValue(options.value);
      } catch (e: unknown) {
        if (current !== version || abort.signal.aborted) return false;
        error.value =
          axios.isAxiosError(e) && e.response?.status === 409
            ? extractMessage(e, options.duplicateMessage).trim() ||
              options.duplicateMessage
            : options.failureMessage;
        return false;
      } finally {
        if (current === version) {
          checking.value = false;
          pending = undefined;
          controller = undefined;
        }
      }
    })();
    return pending;
  };

  return { error, checking, check, reset };
}
