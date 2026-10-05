# Pirate Kit — 船・ボート11モデル選集

Kenney「Pirate Kit 2.1」のネイティブGLBから、静的な11モデルを選んだものです。原作者はKenney、選定・梱包はEclair Assetsです。Kenney公式配布物ではなく、提携・公認を意味しません。

## 収録内容

帆付きの船アセンブリ7点、オール付き手こぎボート2点、横桁と旗を備えた単体マスト2点を収録します。単体マストには布の帆はなく、mast-ropes.glbには支索も含まれます。元のモデル構成は変更していません。Pirate Kit全体ではなく、選定した一部を収録します。

| ファイル | 三角形数 |
| --- | ---: |
| boat-row-large.glb | 174 |
| boat-row-small.glb | 168 |
| mast-ropes.glb | 350 |
| mast.glb | 302 |
| ship-ghost.glb | 1,703 |
| ship-large.glb | 1,849 |
| ship-medium.glb | 1,723 |
| ship-pirate-large.glb | 1,938 |
| ship-pirate-medium.glb | 1,812 |
| ship-pirate-small.glb | 1,461 |
| ship-small.glb | 1,370 |

合計12,850三角形。11モデルにアニメーションクリップとスキンはありません。「アニメーション付き」とは案内しません。共有テクスチャは512 × 512 PNGのカラーパレット1枚です。難破船・植物・島・キャラクター・砦・単体の大砲は収録しません。海賊船3種の前方の帆には汎用的なドクロ模様が残っています。紹介画像は各モデルを個別に収めたもので、相対的な大きさの比較ではありません。

## 色を保ったまま読み込むには

1. ZIP全体を先に展開します。
2. `Models/GLB format/` 内のGLBを読み込みます。
3. `Models/GLB format/Textures/colormap.png` を、そのままの相対位置に残してください。全モデルが `Textures/colormap.png` を参照します。
4. GLBを移す場合は `Textures` サブフォルダーも一緒に移します。GLBだけ移すと色が失われることがあります。正しい色表示のため、外部PNG参照と `KHR_texture_transform` に対応した読み込み環境を使ってください。この拡張は `extensionsUsed` に記録され、`extensionsRequired` には指定されていません。

GLB単体に全データが埋め込まれた形式ではありません。埋め込み・変換は行っておらず、原作のジオメトリ・マテリアル・パレットのバイト列を変更していません。読み込み先で大きさ・向き・表示をご確認ください。特定アプリへの完全対応や実寸単位は保証していません。

## ライセンスと原作者

原モデルとパレットはCC0 1.0です。原文の `License.txt` を同梱しています。個人・教育・商用利用ができ、作者クレジットは任意です。[原配布ページ](https://kenney.nl/assets/pirate-kit)・[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)も確認できます。

任意の表記例：「Pirate Kit by Kenney — kenney.nl (CC0). Unofficial selection by Eclair Assets.」

Eclair Assetsが作成した説明文・検証コードもCC0 1.0で提供し、原素材に新しい制限を加えません。提携・公認・Kenneyブランドの利用許可を意味しません。

## AI支援について

Eclair Assetsは説明文・検証・表示・画像構成コードの作成にAIを利用しました。モデルとパレットはKenneyのアーカイブと同一バイトで、Eclair AssetsがAI生成のモデルやテクスチャを加えたものではありません。原作者の制作工程全体を独立に確認したわけではなく、上流素材全体を「AI不使用」と保証する表記ではありません。

## 無料ダウンロードと任意の支援

itch.ioでは無料（$0）でダウンロードでき、任意の支援額の目安を$1とする予定です。支払いは必須ではありません。支払い画面が出た場合は “No thanks, just take me to the downloads.” から無料で進めます。公開前にこのZIPを受け取った場合、ZIPの存在だけではitch.ioの公開済み状態を示しません。実際の公開ページと無料経路は公開時に別途確認します。

## ファイルの検証

`MODEL_MANIFEST.json` に11モデル・パレット・原文ライセンスのサイズとSHA-256を記録しています。`Verify-Payload.ps1` はネットワークやファイル変更を使わず13ファイルを検証します。PowerShell 7（`pwsh`）を使い、ご自身の環境の実行ポリシーに従ってスクリプトを確認してください。この確認のために恒久的なポリシーを緩める必要はありません。

```powershell
pwsh -NoProfile -File .\Verify-Payload.ps1 -PayloadRoot "C:\path\to\extracted-package"
```

`PayloadRoot` は `License.txt` と `Models` を含むフォルダーです。成功時は `"passed": true` を含むJSONを表示します。検証対象はペイロードの一致とモデルフォルダー内のファイル一覧です。電子署名・見た目の品質・商用用途への適合性・ZIPのチェックサム・アプリ互換性を保証するものではありません。

2026-09-08のKhronos検証（2.0.0-dev.3.10）はエラー0、警告0、情報59件でした。情報の内訳は同梱パレットへの外部参照11件と、元の未使用タンジェント48件です。「全重要度ゼロ」ではありません。
