# 世界資料地圖

用世界地圖瀏覽各國資料，目前有「人口」主題（UN World Population Prospects 2024，1950–2100）。
架構與新增主題的方法見 [DESIGN.md](DESIGN.md)。

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

下載的原始檔會快取在 `pipeline/.cache/`，這個資料夾不進版本控制。

## 建置

```bash
npm run build
```

輸出在 `dist/`，可以放到任何靜態主機。
