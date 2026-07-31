# Contributing

## 基本方針

- 1回の変更目的を小さく保ちます。
- mainを直接変更せず、作業ブランチとPull Requestを使います。
- 外部ライブラリ、外部API、ビルド処理を安易に追加しません。
- エントリークラスのスマートフォンとタブレットを基準にします。
- 画像を外部へ送る変更は採用しません。
- 表示文は初心者が次の操作を判断できる日本語にします。

## ファイルの役割

core.jsは設定と検査、patch-render.jsは部分修正、render.jsは全体描画を担当します。app-base.jsは状態、app-patches.jsは部分修正UI、app-io.jsは入出力、app.jsはプレビューとイベントを担当します。

## 必須検査

```text
node --check core.js
node --check patch-render.js
node --check render.js
node --check app-base.js
node --check app-patches.js
node --check app-io.js
node --check app.js
node tests/core.test.js
node tests/render.test.js
node tests/static.test.js
node tests/app-smoke.test.js
```

画面変更では、360px、768px、1280px程度の幅で確認します。

## Pull Request

変更内容、理由、初心者への影響、低性能端末への影響、セキュリティへの影響、実行した検査、Revert後の状態を記載します。

mainへの反映はsquash mergeを基本にします。
