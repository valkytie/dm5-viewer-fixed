# DM5 Viewer Fixed

English | [繁體中文](#繁體中文)

DM5 Viewer Fixed is a Tampermonkey userscript for reading supported DM5 chapter pages in a continuous scrolling layout.

This project is a modified and partially rewritten userscript based on [emma2334/DM5-Viewer](https://github.com/emma2334/DM5-Viewer), originally authored by Emma and licensed under the MIT License.

## Features

- Expands supported DM5 chapter pages into a continuous reader.
- Hides page chrome that reduces reading space.
- Keeps a small floating toolbar for width switching, light/dark mode, and next chapter navigation.
- Adds retry controls for images that fail or take too long to load.
- Adds an optional, off-by-default auto-next mode that keeps one chapter preloaded ahead without navigating away.
- Detects DM5 anti-hotlink placeholders and reports a readable error.

## Installation

1. Install a userscript manager such as [Tampermonkey](https://www.tampermonkey.net/).
2. Install or copy `DM5-Viewer-fixed.user.js` into Tampermonkey.
3. Open a supported DM5 chapter URL such as `https://www.dm5.com/m123456/`.

## Notes

This userscript does not include, redistribute, or host any manga images. It only changes the reading layout of pages that the user opens in their own browser.

Some DM5 pages no longer expose reader images or return anti-hotlink placeholder images. Those pages cannot be fixed by this script alone.

## License

MIT License. See [LICENSE](LICENSE).

This repository includes the original MIT copyright notice for Emma, as required by the original license.

## Attribution

Based on [DM5-Viewer](https://github.com/emma2334/DM5-Viewer) by Emma.

## 繁體中文

DM5 Viewer Fixed 是一個 Tampermonkey 使用者腳本，用來把支援的 DM5 章節頁改成連續捲動閱讀模式。

本專案是基於 [emma2334/DM5-Viewer](https://github.com/emma2334/DM5-Viewer) 修改並部分重寫而成。原始專案作者為 Emma，授權為 MIT License。

## 功能

- 將支援的 DM5 章節頁展開成連續閱讀模式。
- 隱藏會占用閱讀空間的頁面元素。
- 保留小型浮動工具列，可切換寬度、開關燈、前往下一章。
- 圖片讀取失敗或逾時時，可在失敗位置點選重新讀取。
- 新增預設關閉的自動下一章模式，開啟後只會維持預載下一章，不會無限制載入後續章節，也不會直接跳轉頁面。
- 偵測 DM5 防盜連占位圖，並顯示可讀的錯誤訊息。

## 安裝方式

1. 安裝使用者腳本管理器，例如 [Tampermonkey](https://www.tampermonkey.net/)。
2. 將 `DM5-Viewer-fixed.user.js` 安裝或貼到 Tampermonkey。
3. 開啟支援的 DM5 章節網址，例如 `https://www.dm5.com/m123456/`。

## 注意事項

本腳本不包含、不重新散布、也不代管任何漫畫圖片。它只會調整使用者自己在瀏覽器中開啟的頁面閱讀版面。

有些 DM5 頁面已不再提供原始閱讀圖片，或只回傳防盜連占位圖。這類頁面無法單靠本腳本修復。

## 授權

MIT License。請見 [LICENSE](LICENSE)。

本 repo 依照原始 MIT 授權要求，保留 Emma 的原始 copyright notice。

## 致謝

基於 Emma 的 [DM5-Viewer](https://github.com/emma2334/DM5-Viewer) 修改。
