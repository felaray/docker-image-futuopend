.PHONY: build

export FUTU_VERSION=10.3.6308

# 容器資源限制（可被環境變數覆蓋）
DOCKER_CPUS   := $(or $(DOCKER_CPUS),1.0)
DOCKER_MEMORY := $(or $(DOCKER_MEMORY),1g)

# FutuOpenD could only be built as linux/amd64, or there will be an issue:
# Issue on Apple Silicon
# Ref: https://stackoverflow.com/questions/71040681/qemu-x86-64-could-not-open-lib64-ld-linux-x86-64-so-2-no-such-file-or-direc
build:
	DOCKER_DEFAULT_PLATFORM=linux/amd64 docker build \
		--progress=plain \
		-t felaray/futuopend:$(FUTU_VERSION) \
  		--build-arg FUTU_VERSION=$(FUTU_VERSION)_Ubuntu18.04 \
		.

debug:
	docker rm -f FutuOpenD 2>/dev/null || true   # ← 新增：移除舊容器
	docker run \
		--name FutuOpenD \
		--rm \                                      # ← 新增：退出時自動刪除
		-it \
		--cpus="$(DOCKER_CPUS)" \                  # ← 新增：CPU限制
		--memory="$(DOCKER_MEMORY)" \              # ← 新增：記憶體限制
		-p 8083:8083 \
		-p 11111:11111 \
		-e "FUTU_LOGIN_ACCOUNT=$(FUTU_LOGIN_ACCOUNT)" \
		-e "FUTU_LOGIN_PWD_MD5=$(FUTU_LOGIN_PWD_MD5)" \
		-e "FUTU_LOG_LEVEL=$(FUTU_LOG_LEVEL)" \
		-e "SERVER_PORT=8083" \
		felaray/futuopend:$(FUTU_VERSION)

push:
	docker tag felaray/futuopend:$(FUTU_VERSION) felaray/futuopend:latest
	docker push felaray/futuopend:$(FUTU_VERSION)
	docker push felaray/futuopend:latest

.PHONY: build debug push