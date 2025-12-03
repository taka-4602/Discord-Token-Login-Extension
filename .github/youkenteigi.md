# Discord Token Login Extension 要件定義書

## 1. プロジェクト概要

### プロジェクト名
Discord Token Login Extension - Ozeu Chan Edition

### 目的
DiscordトークンによるワンクリックログインをChrome拡張機能として実現し、複数アカウントの保存・管理機能を提供する

### 技術スタック
- **言語**: JavaScript (Vanilla JS)
- **プラットフォーム**: Chrome Extension (Manifest V3)
- **API**: Discord Web API
- **ストレージ**: Chrome Storage Local API

## 2. 機能要件

### 2.1 主要機能

#### トークンログイン機能
- **機能概要**: Discordトークンを入力してDiscordに自動ログイン
- **入力**: Discord Token（文字列）
- **出力**: Discord Web版への自動ログイン実行
- **処理フロー**:
  1. ポップアップUIでトークン入力
  2. トークンバリデーション（Discord API）
  3. URLパラメータ付きでDiscord.comを開く
  4. Content ScriptでlocalStorageにトークンを保存
  5. Discord.com/channels/@meにリダイレクト

#### アカウント保存機能
- **機能概要**: 有効なアカウント情報をローカルに保存
- **保存データ**:
  - ユーザーID (id)
  - ユーザー名 (username)
  - 表示名 (global_name)
  - アバター画像URL (avatar)
  - トークン (token)
  - 保存日時 (savedAt)
- **ストレージ**: Chrome Extension Storage Local API

#### 保存アカウント管理機能
- **表示**: 保存済みアカウント一覧の表示/非表示切り替え
- **選択ログイン**: 保存アカウントをクリックで即座にログイン
- **削除**: 個別アカウントの削除（アニメーション付き）
- **重複処理**: 同一IDのアカウントは上書き更新

#### 大量トークン一括処理機能
- **機能概要**: 複数のトークンを一括で処理・保存
- **入力方式**:
  - テキストファイル読み込み（.txt形式）
  - 直接テキストエリア入力
- **対応フォーマット**:
  - `token/token` (スラッシュ区切り)
  - `token token` (スペース区切り)
  - `token,token` (カンマ区切り)
- **処理機能**:
  - 複数フォーマット自動認識
  - トークン重複除去
  - 検証は行わなくて良い（ログインボタンを押したときにログインするようにするそこで無理
  だったのならばできませんでしたという表示でアカウウント名の横にmissをついかする）

- **UI**: 展開式タブ形式（既存のアカウント一覧と同様）

### 2.2 UI/UX機能

#### レスポンシブデザイン
- **サイズ**: 320px幅の固定ポップアップ
- **テーマ**: Discord風ダークテーマ
- **アニメーション**: 
  - フェードイン効果
  - ホバー・クリック時のスケーリング
  - シェイクアニメーション（エラー時）
  - スライドアニメーション（アカウント削除時）

#### エラーハンドリング
- **401エラー**: 無効なトークンの通知
- **API接続エラー**: ネットワークエラーの表示
- **入力検証**: 空文字入力時の警告表示

#### 外部リンク機能
- **Discord アイコン**: クリックでhttps://discord.ozeu.net を新規タブで開く

## 3. 非機能要件

### 3.1 セキュリティ要件
- **トークン保護**: トークンはローカルストレージにのみ保存
- **通信暗号化**: HTTPS接続の必須化
- **権限最小化**: 必要最小限のChrome Extension権限

### 3.2 パフォーマンス要件
- **応答時間**: API レスポンス 3秒以内
- **メモリ使用量**: 軽量実装（vanilla JS使用）
- **ストレージ**: ローカルストレージの効率的利用

### 3.3 互換性要件
- **ブラウザ**: Chrome Extension Manifest V3対応
- **Discord**: Discord Web版対応
- **API**: Discord API v9対応

## 4. システム構成

### 4.1 ファイル構成
```
chrome_extension/
├── manifest.json          # Extension設定ファイル
├── index.html            # ポップアップUI
├── script.js             # メインロジック
├── content.js            # Content Script
├── style.css            # スタイルシート
└── icon_*.png           # 拡張機能アイコン
```

### 4.2 権限設定
- **storage**: ローカルデータ保存用
- **host_permissions**: Discord APIアクセス用（https://discord.com/api/*）
- **content_scripts**: Discord.com上でのトークン注入用

### 4.3 API連携
- **Discord API Endpoint**: `https://discord.com/api/v9/users/@me`
- **認証方式**: Authorization ヘッダーによるトークン認証
- **レスポンス処理**: JSON形式のユーザー情報取得

## 5. 制約事項

### 5.1 技術制約
- Chrome Extension Manifest V3の制限に準拠
- Discord利用規約の範囲内での使用
- Cross-Origin制約によるAPI制限

### 5.2 運用制約
- トークンの適切な管理が必要
- Discord APIレート制限の考慮
- セキュリティ上の責任は利用者に帰属

## 6. 今後の拡張可能性
- 他ブラウザ対応（Firefox、Edge等）
- 二段階認証対応
- テーマカスタマイズ機能
- バックアップ・同期機能
- アカウントグループ管理機能