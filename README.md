# 世界資料地圖

用世界地圖瀏覽各國資料。除了純地圖頁，目前有以下資料主題：

- 人口
- 人均收入
- 發電量
- 產業結構
- 工業
- 農業
- 貿易（國際貿易流向：點選國家，畫出它跟主要貿易夥伴之間的弧線）
- AI
- 交通
- 氣候（二氧化碳排放）
- 軍事（軍費、兵力）

地圖可以切換地球儀與平面、一路放大到街道，並有五種底圖配色可選。人口主題可以在地圖上框選範圍，估算框內人口。資料來源、架構與新增主題的方法見 [DESIGN.md](DESIGN.md)。

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

可用的步驟：`geo`、`population`、`population-grid`、`income`、`sectors`、`agriculture`、`electricity`、`industry`、`ai`、`transport`、`climate`、`trade`、`military`。

`population-grid` 是框選估算用的網格人口，要先有 `geo` 的國界。

下載的原始檔會快取在 `pipeline/.cache/`，這個資料夾不進版本控制。第一次跑全部大約要下載 2.4 GB（主要是 FAOSTAT 的貿易檔與雙邊貿易矩陣、CEPII BACI、GHS-POP 的網格人口和 Anthropic Economic Index），世界銀行 API 比較慢，全部跑完約 30 分鐘，其中 `trade` 要讀 8.5 GB 的 FAOSTAT 雙邊貿易矩陣，約占一半。

## 建置

```bash
npm run build
```

輸出在 `dist/`，可以放到任何靜態主機。

## 部署

推送到 `main` 後，GitHub Actions（`.github/workflows/deploy.yml`）會自動建置並發佈到 GitHub Pages，約 1–2 分鐘。
資料檔已經在版本庫裡，所以更新資料的流程是：本機執行 `npm run data`，再把 `public/data/` 的變更提交、推送。
