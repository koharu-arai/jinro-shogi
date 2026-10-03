# 人狼将棋(ウェブ版)

正体を隠した6枚の駒で相手の王様を狙う、人狼将棋のウェブアプリです。

- **オンライン対戦**: 部屋コードか招待リンクで、離れた相手とそれぞれのスマホで対戦
- **1台で対戦**: スマホ1台を交代で渡しながら2人で遊ぶ

ビルド不要の静的サイトです(HTML・CSS・JavaScript のみ)。オンライン対戦のデータ保存とリアルタイム通信に Supabase を使います。

## ファイル

| ファイル | 内容 |
| --- | --- |
| `index.html` | ページ本体 |
| `style.css` | 見た目 |
| `app.js` | ゲームのルール・画面・オンライン通信 |
| `config.js` | Supabase の接続先(ここだけ書き換える) |
| `supabase.sql` | Supabase に作るテーブル |

## 公開までの手順

### 1. Supabase の準備
1. https://supabase.com で新しいプロジェクトを作る
2. 左メニューの **SQL Editor** を開き、`supabase.sql` の中身を全部貼り付けて **Run**
3. **Project Settings → API** を開き、`Project URL` と `anon public` キーをコピー
4. `config.js` の `SUPABASE_URL` と `SUPABASE_ANON_KEY` に貼り付けて保存

### 2. GitHub に置く
1. GitHub で新しいリポジトリ(例: `jinro-shogi`)を作る
2. このフォルダのファイルを全部アップロードする(「Add file → Upload files」でドラッグ&ドロップでもOK)

### 3. Vercel で公開
1. https://vercel.com で **Add New → Project** を選び、さっきのリポジトリを Import
2. Framework Preset は **Other** のまま、設定は何も変えずに **Deploy**
3. 発行された URL を開けば完成。友達にはそのURLか、部屋を作ったあとの「招待リンク」を送るだけで遊べます

## 手元で試す
ファイルを直接ダブルクリックで開くと動きません(`app.js` をモジュールとして読むため)。このフォルダでターミナルを開き、次のどちらかを実行して `http://localhost:8000` を開いてください。

```
npx serve -l 8000
# または
python3 -m http.server 8000
```

## 注意
- ログインなしで遊べるよう、データベースは誰でも読み書きできる設定です。相手の駒の配置も通信データには含まれるので、詳しい人ならのぞき見できます。友達同士で遊ぶ前提の作りです。
- 古い部屋は自動では消えません。気になったら `supabase.sql` の最後にある削除の SQL を実行してください。
