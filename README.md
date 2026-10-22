# 世界資料地圖

用世界地圖瀏覽各國資料。除了純地圖頁，目前有以下資料主題：

- 人口
- 人均收入
- 發電量
- 產業結構
- 工業
- 農業
- AI
- 交通
- 氣候（二氧化碳排放）
- 軍事（軍費、兵力）
- 數位（網路、行動電話、固網寬頻）
- 健康（平均壽命、嬰幼兒死亡率、醫療支出、醫師數）
- 教育（受教育年數、高等教育在學率、教育支出、識字率）
- 觀光（國際旅客、觀光收入）

地圖可以切換地球儀與平面、一路放大到街道，並有五種底圖配色可選。人口主題可以在地圖上框選範圍，估算框內人口。

每個畫面右上角的「分享」可以下載地圖圖片（PNG，含標題、圖例與資料來源）、下載目前指標的 CSV（選定年份或所有年份，Excel 可直接開啟），或複製這個畫面的連結。

資料來源、架構與新增主題的方法見 [DESIGN.md](DESIGN.md)。

## 操作

- **搜尋國家**：中文、英文、常用別名（南韓、韓國、Korea；美國、USA；英國、UK；中國、大陸）或 ISO 代碼（TW、TWN）都找得到，打一部分或拼錯一兩個字母也可以。結果會列出目前的數值，選了之後地圖會飛到那個國家。
- **鍵盤快捷鍵**（按 `?` 或右上角的「?」看說明）：
  - `/`：搜尋
  - `←` `→`：換年份
  - 空白鍵：播放／暫停
  - `+` `−`：縮放地圖
  - `Esc`：取消選取
- **手機**：國家資料從底部抽屜拉起，可以拖到收合、半開、全開三段，往下拖到底就關閉。

網站：https://skywitness.github.io/map/

## 開發

```bash
npm install
npm run dev
```

`public/data/` 裡已經有產生好的資料，只改前端的話不需要跑資料管線。

## 重新產生資料

第一次使用時，先建立 Python 環境：

```bash
python -m venv pipeline/.venv
pipeline/.venv/Scripts/python -m pip install -r pipeline/requirements.txt
```

（macOS / Linux 的路徑是 `pipeline/.venv/bin/python`。）

產生資料：

```bash
npm run data                   # 全部
npm run data -- population     # 只跑人口
npm run data -- --refresh      # 忽略快取，重新下載原始資料
```

可用的步驟：`geo`、`population`、`population-grid`、`income`、`sectors`、`agriculture`、`electricity`、`industry`、`ai`、`transport`、`climate`、`military`、`digital`、`health`、`education`、`tourism`。

`population-grid` 是框選估算用的網格人口，要先有 `geo` 的國界。

下載的原始檔會快取在 `pipeline/.cache/`，這個資料夾不進版本控制。第一次跑全部大約要下載 1.2 GB（主要是 FAOSTAT 的貿易檔、GHS-POP 的網格人口和 Anthropic Economic Index），世界銀行 API 比較慢，全部跑完約 12 分鐘。

## 建置

```bash
npm run build
```

輸出在 `dist/`，可以放到任何靜態主機。

## 部署

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會自動建置並發佈到 GitHub Pages，約 1–2 分鐘。
資料檔已經在版本庫裡，所以更新資料的流程是：本機執行 `npm run data`，再把 `public/data/` 的變更提交、推送。
