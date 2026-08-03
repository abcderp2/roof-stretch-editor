# 保守手順

この文書は、初心者でも、画像を外部へ送らず、追加課金なしのまま、変更、確認、公開、切り戻しを同じ順序で行うための手順です。Node.jsの標準機能だけで検査できます。

## 変更前

1. mainのGitHub ActionsとGitHub Pagesの公開状態を確認する
2. 変更目的を一文にし、関係のない修正を同じPull Requestへ混ぜない
3. `git status --short`で既存の差分を確認する
4. mainを直接変更せず、作業ブランチを作る
5. README.md、SECURITY.md、CONTRIBUTING.md、MAINTENANCE.mdを読む

APIキー、パスワード、秘密鍵、個人情報、利用者の画像をHTML、Markdown、Issue、Pull Request、コミットへ貼り付けません。分からない差分を削除、上書き、全体置換しません。

## 変更の境界

通常の修正は、該当するHTML、CSS、JavaScript、テスト、README、SECURITY.mdだけに限定します。

既定では、外部ライブラリ、外部API、CDN、広告、解析、Cookie、永続ストレージ、画像の外部送信、ビルド処理を追加しません。

対応形式や編集方法を増やす場合は、入力署名、寸法、画素数、出力寸法、レシピの項目数と数値範囲、低性能端末の上限、処理後のメモリ解放、README、SECURITY.md、テストを同じ変更で更新します。

HTMLへ外部入力をinnerHTMLで入れず、eval、動的Function生成、fetch、WebSocketを追加しません。Blob URLと一時Canvasは使用後に解放します。

## 自動検査

追加パッケージは不要です。リポジトリ直下で次を順番に実行します。

```sh
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

## 手動確認

画面変更では、幅280px、320px、360px、768px、1024px、1440px、スマートフォン横向きで確認します。

1. サンプル画像を作成し、画像が外部へ送信されない
2. JPEG、PNG、WebPを読み込み、形式不一致、18MB超過、画素数超過、一辺超過が拒否される
3. 2画面プレビュー、矩形選択、指操作、マウス操作、キーボード操作を確認する
4. 8種類の部分修正、追加、更新、削除、元に戻す、やり直すを確認する
5. 400%拡大、縦向き、横向き、文字サイズ拡大、動きを減らす設定、高コントラストを確認する
6. PNG、JPEG、WebPの保存と設定レシピの書き出し、読み込みを確認する
7. 低性能端末でプレビューと保存の上限が下がり、処理後にCanvasとObject URLが解放される
8. Networkで外部通信がなく、ブラウザのコンソールに予期しない例外がない

自動検査が成功しても、実機の表示、編集結果、保存ファイルを確認します。

## 文書と公開

入力上限、出力上限、対応形式、CSP、外部通信、robots.txt、ai.txt、sitemap.xmlを変更した場合は、README.md、SECURITY.md、CONTRIBUTING.md、MAINTENANCE.mdの説明を揃えます。

Pull Requestには、変更理由、利用者への影響、低性能端末への影響、セキュリティへの影響、実行した検査、切り戻し方法を記載します。自動検査と差分確認が終わるまでmainへ反映しません。

公開後は、正規URL、robots.txt、主要操作、外部通信なし、スマートフォン表示を確認します。GitHub Pagesのプロジェクトサイトにあるrobots.txtは、ドメイン直下のrobots.txtと同じ範囲を保証しません。

## 切り戻し

問題が見つかったら、対象のPull Requestまたはマージコミットを特定してからGitHubのRevertを使います。

```sh
git log --oneline -n 10
git revert <戻したいマージコミット>
git push
```

対象が分からないまま`git reset --hard`、履歴の強制push、リポジトリ削除を実行しません。切り戻し後も自動検査を再実行します。

## AIへ保守を依頼する場合

最初に次の条件を伝えます。

```text
このリポジトリは追加課金なしのGitHub Pages静的サイトです。
画像処理は端末内だけで行い、外部API、CDN、広告、解析、Cookie、永続ストレージを追加しません。
低性能端末、幅280pxからの表示、入力検証、CanvasとBlob URLの解放を維持します。
変更は小さく1目的に絞り、Node.js標準機能の自動検査を実行してからPull Requestにします。
README.md、SECURITY.md、CONTRIBUTING.md、MAINTENANCE.mdの説明を同じ差分で確認します。
```

AIが提案した差分は、対象ファイル、表示幅、入力上限、外部通信、秘密情報、切り戻し方法を人が確認してから反映します。
