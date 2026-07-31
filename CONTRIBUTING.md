# Contributing

## 基本方針

追加課金、外部API、利用登録、ビルド必須化、依存パッケージの追加は原則として行いません。エントリークラスのスマートフォンとタブレットを基準にします。

総合デザインツールへ広げず、画像の局所変形、外周生成、比率再構成に関係する変更へ絞ります。

## 変更手順

1. mainから作業ブランチを作る
2. 1つの目的に関係する差分だけを入れる
3. READMEやSECURITYの説明が変わる場合は同じ差分で更新する
4. 自動検査を実行する
5. スマートフォン幅とデスクトップ幅で手動確認する
6. プルリクエストのFiles changedで不要なファイルがないか確認する
7. squash mergeする

## 必須検査

```text
node --check core.js
node --check render.js
node --check app.js
node tests/core.test.js
node tests/render.test.js
node tests/static.test.js
```

## 実装上の注意

入力値は必ず正規化し、画像寸法とCanvas寸法に上限を設けます。ユーザー入力を `innerHTML` へ入れません。外部通信を追加しません。画像をLocalStorageやIndexedDBへ保存しません。

描画ロジックは `render.js`、計算と検査は `core.js`、画面操作は `app.js` へ置きます。無料プランの一般的なAIでも1ファイルだけを読んで修正範囲を判断できる状態を保ちます。
