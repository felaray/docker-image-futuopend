[English Version](./README.en.md) | [简体中文版](./README.zh-CN.md)

# Docker Image 鏡像: felaray/FutuOpenD

[![Build Status](https://github.com/kaelzhang/docker-image-futuopend/actions/workflows/docker.yml/badge.svg)](https://github.com/kaelzhang/docker-image-futuopend/actions/workflows/docker.yml)

真正可用的 FutuOpenD Docker 鏡像。

建立這個專案的原因是，我試過很多 FutuOpenD 的 Docker 鏡像：
- 要嘛根本無法啟動
- 要嘛沒有處理簡訊驗證碼
- 要嘛需要手動 `docker exec` 進容器處理驗證碼，導致不利於維運

容器啟動後會執行：
- 一個 FutuOpenD agent
- 一個 WebSocket 伺服器，用於檢查 FutuOpenD agent 的就緒狀態，並支援你提供簡訊驗證碼以完成必要初始化

該鏡像一律使用 `DOCKER_DEFAULT_PLATFORM=linux/amd64` 建置（[why?](https://stackoverflow.com/questions/71040681/qemu-x86-64-could-not-open-lib64-ld-linux-x86-64-so-2-no-such-file-or-direc)），可在 Ubuntu 與 MacOS 上執行。

## 安裝

```sh
docker pull felaray/futuopend:latest
```

或

```sh
docker pull felaray/futuopend:10.3.6308
```

## 目前支援的 FutuOpenD 鏡像版本

- 10.3.6308_Ubuntu18.04
- 9.4.5418_Ubuntu16.04
- 9.4.5408_Ubuntu16.04
- 9.3.5308_Ubuntu16.04
- 9.2.5208_Ubuntu16.04

[其他版本](https://hub.docker.com/r/felaray/futuopend/tags)

## 用法

### 環境變數

- **FUTU_LOGIN_ACCOUNT** `string`（必填）
- **FUTU_LOGIN_PWD_MD5** `string`（必填）
- **FUTU_LANG** `string`，預設 `chs`
- **FUTU_LOG_LEVEL** `string`，預設 `no`
- **FUTU_IP** `string`，預設 `"0.0.0.0"`。這與 FutuOpenD CLI 的預設 IP `127.0.0.1` 不同；由於本專案常用於 Kubernetes 叢集，需要讓 FutuOpenD 可以接受其他容器的請求。
- **FUTU_PORT** `integer`，FutuOpenD 的埠號，預設 `11111`
- **SERVER_PORT** `integer`，WebSocket 伺服器的埠號，預設 `8000`
- **FUTU_INIT_ON_START** `string="yes"`，容器啟動時是否初始化 Futu OpenD agent，預設 `"yes"`
- **FUTU_SUPERVISE_PROCESS** `string="yes"`，是否監控 FutuOpenD 子程序，並在退出時嘗試重新連線

### 產生 FUTU_LOGIN_PWD_MD5（Windows / Linux / macOS）

`FUTU_LOGIN_PWD_MD5` 需要 32 位元小寫十六進位 MD5 字串（不含空白與換行）。

1. 先設定明文密碼變數

Windows PowerShell：

```powershell
$plain = "your_password_here"
```

Linux/macOS（bash/zsh）：

```sh
plain='your_password_here'
```

2. Windows PowerShell 5.1（內建可用）

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
$md5 = [System.Security.Cryptography.MD5]::Create()
$hashBytes = $md5.ComputeHash($bytes)
$pwdMd5 = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
$pwdMd5
```

3. PowerShell 7+（建議）

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
$hashBytes = [System.Security.Cryptography.MD5]::HashData($bytes)
$pwdMd5 = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
$pwdMd5
```

4. Linux（GNU coreutils）

```sh
pwd_md5=$(printf %s "$plain" | md5sum | awk '{print $1}')
echo "$pwd_md5"
```

5. macOS

```sh
pwd_md5=$(printf %s "$plain" | md5)
echo "$pwd_md5"
```

6. 啟動容器時帶入環境變數（PowerShell 範例）

```powershell
docker run `
--name FutuOpenD `
-e "SERVER_PORT=8081" `
-p 8081:8081 `
-p 11111:11111 `
-e "FUTU_LOGIN_ACCOUNT=你的富途帳號" `
-e "FUTU_LOGIN_PWD_MD5=$pwdMd5" `
felaray/futuopend:latest
```

### Docker Run：如何啟動容器

```sh
docker run \
--name FutuOpenD \
-e "SERVER_PORT=8081" \
-p 8081:8081 \
-p 11111:11111 \
-e "FUTU_LOGIN_ACCOUNT=$your_futu_id" \
-e "FUTU_LOGIN_PWD_MD5=$your_password_md5" \
felaray/futuopend:latest
```

### WebSocket 伺服器

```js
const {WebSocket} = require('ws')

const ws = new WebSocket('ws://localhost:8081')

ws.on('message', msg => {
  const data = JSON.parse(msg)

  if (data.type === 'REQUEST_CODE') {
    ws.send(JSON.stringify({
      type: 'VERIFY_CODE',
      code: '12345'
    }))
    return
  }

  if (data.type === 'STATUS') {
    console.log('status:', data.status)
    return
  }
})

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'STATUS'
  }))

  // 如果環境變數 FUTU_INIT_ON_START=no,
  // 需要手動初始化 FutuOpenD，讓它啟動
  ws.send(JSON.stringify({
    type: 'INIT'
  }))
})
```

下行與上行訊息皆為 JSON 格式。

#### 下行訊息：伺服器 -> 客戶端

```json
{
  "type": "REQUEST_CODE"
}
```

表示 FutuOpenD agent 需要你提供簡訊驗證碼。

```json
{
  "type": "CONNECTED"
}
```

表示 FutuOpenD agent 已連線。

```json
{
  "type": "STATUS",
  "status": -1
}
```

伺服器回傳目前狀態。

```json
{
  "type": "CLOSED"
}
```

表示 FutuOpenD 子程序（意外）退出。

#### 上行訊息：客戶端 -> 伺服器

```json
{
  "type": "INIT"
}
```

告訴伺服器初始化 FutuOpenD agent，僅在環境變數 `FUTU_INIT_ON_START` 設為 `'no'` 時有效。

```json
{
  "type": "STATUS"
}
```

請求伺服器回傳目前狀態。

```json
{
  "type": "VERIFY_CODE",
  "code": "123456"
}
```

向 FutuOpenD agent 提交簡訊驗證碼。

# @ostai/futuopend

## 安裝

```sh
npm i @ostai/futuopend
```

## 用法

```js
const {
  // 連線到 WebSocket 伺服器的 client manager
  FutuOpenDManager,
  // WebSocket 伺服器的狀態列舉
  STATUS,
  // 啟動帶有 mocked FutuOpenD 的測試伺服器
  startMockServer
} = require('@ostai/futuopend')

const kill = startMockServer({
  port
})
```

# 貢獻者指南

## 如何建置你自己的鏡像

```sh
export VERSION=10.3.6308
export FUTU_VERSION=${VERSION}_Ubuntu18.04
```

```sh
TAG=felaray/futuopend


docker build -t $TAG:$VERSION \
  --build-arg FUTU_VERSION=$FUTU_VERSION \
  .
```

例如：

```sh
docker build -t felaray/futuopend:${VERSION} \
  --build-arg FUTU_VERSION=${FUTU_VERSION} \
  .
```
