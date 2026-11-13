// src/plugins/icons.ts
// アイコンは @mdi/js の SVG パスを使い、画面で使うものだけをバンドルする
// (以前の @mdi/font はアイコンフォント全体 ≒ 1.3MB を読み込んでいた)。
// テンプレートは今まで通り "mdi-xxx" の名前で書ける。新しいアイコンを使うときは ICONS に1行足す。
import { h } from "vue";
import type { IconProps, IconSet } from "vuetify";
import { mdi as mdiSvg } from "vuetify/iconsets/mdi-svg";
import {
  mdiAccountCog,
  mdiAlertCircleOutline,
  mdiAnchor,
  mdiArchiveArrowDownOutline,
  mdiBookOpenVariant,
  mdiBookOutline,
  mdiCardAccountDetailsOutline,
  mdiChevronUp,
  mdiClose,
  mdiCloudUploadOutline,
  mdiCross,
  mdiDownload,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiFileDownloadOutline,
  mdiFormatColorText,
  mdiLightningBolt,
  mdiLogin,
  mdiLogout,
  mdiMagnify,
  mdiMagnifyClose,
  mdiMessageOutline,
  mdiMusic,
  mdiNotebookEditOutline,
  mdiPackageVariantClosed,
  mdiPlaylistMusic,
  mdiPlusCircleOutline,
  mdiReceiptTextOutline,
  mdiRestore,
  mdiScriptTextOutline,
  mdiShuffleVariant,
  mdiTrashCanOutline,
  mdiUnfoldMoreHorizontal,
  mdiViewGridOutline,
  mdiYoutube,
} from "@mdi/js";

const ICONS: Record<string, string> = {
  "mdi-account-cog": mdiAccountCog,
  "mdi-alert-circle-outline": mdiAlertCircleOutline,
  "mdi-anchor": mdiAnchor,
  "mdi-archive-arrow-down-outline": mdiArchiveArrowDownOutline,
  "mdi-book-open-variant": mdiBookOpenVariant,
  "mdi-book-outline": mdiBookOutline,
  "mdi-card-account-details-outline": mdiCardAccountDetailsOutline,
  "mdi-chevron-up": mdiChevronUp,
  "mdi-close": mdiClose,
  "mdi-cloud-upload-outline": mdiCloudUploadOutline,
  "mdi-cross": mdiCross,
  "mdi-download": mdiDownload,
  "mdi-eye-off-outline": mdiEyeOffOutline,
  "mdi-eye-outline": mdiEyeOutline,
  "mdi-file-download-outline": mdiFileDownloadOutline,
  "mdi-format-color-text": mdiFormatColorText,
  "mdi-lightning-bolt": mdiLightningBolt,
  "mdi-login": mdiLogin,
  "mdi-logout": mdiLogout,
  "mdi-magnify": mdiMagnify,
  "mdi-magnify-close": mdiMagnifyClose,
  "mdi-message-outline": mdiMessageOutline,
  "mdi-music": mdiMusic,
  "mdi-notebook-edit-outline": mdiNotebookEditOutline,
  "mdi-package-variant-closed": mdiPackageVariantClosed,
  "mdi-playlist-music": mdiPlaylistMusic,
  "mdi-plus-circle-outline": mdiPlusCircleOutline,
  "mdi-receipt-text-outline": mdiReceiptTextOutline,
  "mdi-restore": mdiRestore,
  "mdi-script-text-outline": mdiScriptTextOutline,
  "mdi-shuffle-variant": mdiShuffleVariant,
  "mdi-trash-can-outline": mdiTrashCanOutline,
  "mdi-unfold-more-horizontal": mdiUnfoldMoreHorizontal,
  "mdi-view-grid-outline": mdiViewGridOutline,
  "mdi-youtube": mdiYoutube,
};

/** "mdi-xxx" の名前を SVG パスに変えて、Vuetify の mdi-svg と同じ描画をする */
export const mdiByName: IconSet = {
  component: (props: IconProps) => {
    const name = String(props.icon);
    const path = ICONS[name];
    if (!path && import.meta.env.DEV) {
      console.warn(`[icons] "${name}" が plugins/icons.ts の ICONS にありません`);
    }
    return h(mdiSvg.component, { ...props, icon: path ?? name });
  },
};
