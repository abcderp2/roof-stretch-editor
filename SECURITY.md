# Security Policy

## 対象

mainブランチで公開されている最新版を対象とします。

## 設計

Pixel Reframe Labは静的なGitHub Pagesサイトです。画像処理はブラウザ内で完結し、画像、レシピ、操作履歴を外部サービスへ送信しません。

次の防御を維持します。

- 外部APIと外部依存を追加しない
- Content Security Policyで外部通信と埋め込み対象を制限する
- HTMLのPermissions-Policy metaをセキュリティ防御として扱わない
- JPEG、PNG、WebPの実データ署名と寸法を復号前に確認する
- ファイル容量、画像寸法、画素数、出力寸法を制限する
- レシピの容量、版、配列長、文字列、数値範囲を検証する
- innerHTML、eval、動的Function生成を使用しない
- 画像データをLocalStorageへ保存しない
- Object URLと一時Canvasを使用後に解放する

Content Security Policyはmeta要素で適用できる範囲の防御を維持します。ただし、frame-ancestorsなどmeta要素では適用できない指示を、効いている防御として記載しません。

## 報告時に含める情報

公開Issueへ個人情報や未公開画像を添付しないでください。再現に必要なブラウザ名、端末種別、操作、表示されたエラー、影響範囲を記載してください。

画像ファイル自体が必要な場合は、個人情報を除いた最小の再現用画像を作成してください。

## 制限

GitHub Pagesでは、リポジトリ側から任意のHTTPセキュリティヘッダーを自由に設定できません。そのため、Permissions-Policyをmeta要素で代用しません。現在の静的な用途では、依存を増やさず、CSP、外部通信禁止、入力検査、データ最小化を優先します。

将来、認証、決済、機密データ送信、カメラやマイクなどの端末API、または埋め込み禁止を強く要求する機能を追加する場合は、Permissions-Policyやframe-ancestorsなどをHTTPレスポンスヘッダーで設定できる配信環境への移行を先に検討します。
