# Contributing

## 基本方針

- 1回の変更目的を小さく保ちます。
- mainを直接変更せず、作業ブランチとPull Requestを使います。
- 外部ライブラリ、外部API、ビルド処理を安易に追加しません。
- エントリークラスのスマートフォンとタブレットを基準にします。
- 画像を外部へ送る変更は採用しません。
- 表示文は初心者が次の操作を判断できる日本語にします。

## 変更前

1. READMEの使い方と制限を確認します。
2. core.js、render.js、app.jsのどこを変更するか決めます。
3. unrelatedな変更を同じPull Requestへ混ぜません。

## 必須検査

```text
node --check core.js
node --check render.js
node --check app.js
node tests/core.test.js
node tests/render.test.js
node tests/static.test.js
node tests/app-smoke.test.js
```

画面変更では、360px、768px、1280px程度の幅で確認します。

## Pull Request

本文へ次を記載します。

- 変更内容
- 変更理由
- 初心者への影響
- 低性能端末への影響
- セキュリティへの影響
- 実行した検査
- Revertした場合の戻り方

mainへの反映はsquash mergeを基本にします。
