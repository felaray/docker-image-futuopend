[繁體中文版](./README.md) | [简体中文版](./README.zh-CN.md)

# Docker Image: felaray/FutuOpenD

[![Build Status](https://github.com/kaelzhang/docker-image-futuopend/actions/workflows/docker.yml/badge.svg)](https://github.com/kaelzhang/docker-image-futuopend/actions/workflows/docker.yml)


Docker image for FutuOpenD on Ubuntu, the one that really works and could handle SMS verification requests.

The container will start
- A FutuOpenD agent
- A REST API server which could help to check the ready status of the FutuOpenD agent and make it possible for you to submit an SMS verification code.

The image is always built with `DOCKER_DEFAULT_PLATFORM=linux/amd64` ([why?](https://stackoverflow.com/questions/71040681/qemu-x86-64-could-not-open-lib64-ld-linux-x86-64-so-2-no-such-file-or-direc)) and could be `docker-run` on both Ubuntu and MacOS.


## Table of Content

- [Docker Image](#install)
- [NPM package @ostai/futuopend](#)

## Install

```sh
# Recommended (to pull an image by providing specific tag name)
docker pull felaray/futuopend:10.3.6308
```

Or

```sh
docker pull felaray/futuopend:latest
```

## Lastest FutuOpenD Image Version

- 10.3.6308_Ubuntu18.04
- 9.4.5418_Ubuntu16.04
- 9.4.5408_Ubuntu16.04
- 9.3.5308_Ubuntu16.04
- 9.2.5208_Ubuntu16.04

[Other versions](https://hub.docker.com/r/felaray/futuopend/tags)

## Usage

### Environment Variables

- **FUTU_LOGIN_ACCOUNT** `string` required, login account
- **FUTU_LOGIN_PWD_MD5** `string` required, login password ciphertext (32-bit MD5 encrypted hexadecimal).
- **FUTU_LANG** `string` defaults to `chs`
- **FUTU_LOG_LEVEL** `string` defaults to `no`, options:
  - `"no"` no log (the default value)
  - `"debug"` the most detailed
  - `"info"` less detailed
- **FUTU_IP** `string` defaults to `"0.0.0.0"`, different from the default ip binding address of the FutuOpenD cli, so that it could accept connections from other containers.
- **FUTU_PORT** `integer` the port of the FutuOpenD, defaults to `11111`
- **SERVER_PORT** `integer` the port of the REST API server, defaults to `8000`
- **FUTU_INIT_ON_START** `string="yes"` whether it will initialize the Futu OpenD agent on the start, defaults to `"yes"`
- **FUTU_SUPERVISE_PROCESS** `string="yes"` whether it will supervise the FutuOpenD process

### Generate FUTU_LOGIN_PWD_MD5 (Windows / Linux / macOS)

`FUTU_LOGIN_PWD_MD5` must be a 32-character lowercase hex MD5 string (without spaces or newlines).

1. Set a plaintext password variable first.

Windows PowerShell:

```powershell
$plain = "your_password_here"
```

Linux/macOS (bash/zsh):

```sh
plain='your_password_here'
```

2. Windows PowerShell 5.1

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
$md5 = [System.Security.Cryptography.MD5]::Create()
$hashBytes = $md5.ComputeHash($bytes)
$pwdMd5 = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
$pwdMd5
```

3. PowerShell 7+

```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
$hashBytes = [System.Security.Cryptography.MD5]::HashData($bytes)
$pwdMd5 = ($hashBytes | ForEach-Object { $_.ToString("x2") }) -join ""
$pwdMd5
```

4. Linux (GNU coreutils)

```sh
pwd_md5=$(printf %s "$plain" | md5sum | awk '{print $1}')
echo "$pwd_md5"
```

5. macOS

```sh
pwd_md5=$(printf %s "$plain" | md5)
echo "$pwd_md5"
```

### Docker Run: How to start the container

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

### REST API Server

```sh
curl http://localhost:8081/status
```

Example response:

```json
{
  "status": 1,
  "state": "REQUESTING_VERIFICATION_CODE"
}
```

Initialize the FutuOpenD agent:

```sh
curl -X POST http://localhost:8081/init
```

Submit an SMS verification code:

```sh
curl -X POST http://localhost:8081/verification-code \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"123456\"}"
```

If you prefer Node.js:

```js
const baseUrl = 'http://localhost:8081'

const status = await fetch(`${baseUrl}/status`).then(r => r.json())
console.log(status)

await fetch(`${baseUrl}/init`, { method: 'POST' })
await fetch(`${baseUrl}/verification-code`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify({ code: '123456' })
})
```

# @ostai/futuopend

## Install

```sh
npm i @ostai/futuopend
```

## Usage

```js
const {
  // The client manager to connect to the REST API server
  FutuOpenDManager,
  // STATUS enum shared by the REST API server
  STATUS,
  // To start the mock server with a mocked FutuOpenD for testing purposes
  startMockServer
} = require('@ostai/futuopend')

const kill = startMockServer({
  port
})
```



# For contributors

## How to build your own image

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

For example:

```sh
docker build -t felaray/futuopend:${VERSION} \
  --build-arg FUTU_VERSION=${FUTU_VERSION} \
  .
```
