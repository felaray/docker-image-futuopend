# https://softwaredownload.futunn.com/Futu_OpenD_10.3.6308_Ubuntu18.04.tar.gz

# ==============================================================================
# Stage 1: Build Python from Source
# ==============================================================================
FROM ubuntu:18.04 AS builder

# Set non-interactive mode for apt-get
ENV DEBIAN_FRONTEND=noninteractive

ARG NODE_VERSION=16.20.2
ARG NODE_DISTRO=linux-x64
ARG NODE_SHA256=874463523f26ed528634580247f403d200ba17a31adf2de98a7b124c6eb33d87

RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    libffi-dev \
    libgdbm-dev \
    libncurses5-dev \
    libreadline-dev \
    libsqlite3-dev \
    libssl-dev \
    libtk8.6 \
    wget \
    xz-utils \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSLo /tmp/node.tar.xz --retry 5 --retry-delay 5 --retry-connrefused \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${NODE_DISTRO}.tar.xz" \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm -f /tmp/node.tar.xz

ARG PYTHON_VERSION=3.8.20
ARG PYTHON_SHORT_VERSION=3.8

# Install Python
# ------------------------------------------------------------------------------

# Python is required to build node-gyp

WORKDIR /usr/src

# Download and extract Python source
RUN curl -fsSLo Python-${PYTHON_VERSION}.tgz --retry 5 --retry-delay 5 --retry-connrefused \
    https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz \
&& tar xzf Python-${PYTHON_VERSION}.tgz \
&& rm Python-${PYTHON_VERSION}.tgz

# Compile and install Python
WORKDIR /usr/src/Python-${PYTHON_VERSION}

RUN ./configure --enable-optimizations \
&& make -j "$(nproc)" \
&& make altinstall

# Create symbolic links for python and python3
RUN ln -s /usr/local/bin/python${PYTHON_SHORT_VERSION} /usr/local/bin/python3 \
&& ln -s /usr/local/bin/python${PYTHON_SHORT_VERSION} /usr/local/bin/python

# Verify python installation
RUN python --version && python3 --version

ENV PYTHON=/usr/local/bin/python${PYTHON_SHORT_VERSION}

# /end install python ----------------------------------------------------------

WORKDIR /usr/src

COPY package*.json ./

# This will install dependencies in /usr/src/node_modules
RUN npm i --omit=dev

# ==============================================================================
# Stage 2: Create Final Runtime Image
# ==============================================================================
FROM ubuntu:18.04

# Install wget and certificates for downloading the FutuOpenD archive
RUN apt-get -o Acquire::Retries=5 update \
    && apt-get -o Acquire::Retries=5 install -y --no-install-recommends ca-certificates wget \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /usr/src/app

ARG FUTU_VERSION=10.3.6308_Ubuntu18.04

COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/bin/npm /usr/local/bin/npm
COPY --from=builder /usr/local/bin/npx /usr/local/bin/npx
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules

RUN set -eux; \
wget --tries=5 --waitretry=5 --retry-connrefused -O Futu_OpenD.tar.gz https://softwaredownload.futunn.com/Futu_OpenD_$FUTU_VERSION.tar.gz; \
tar -xf Futu_OpenD.tar.gz; \
mkdir bin; \
archive_dir="$(find . -type f -name FutuOpenD -exec dirname {} \; | head -n 1)"; \
test -n "$archive_dir"; \
cp -a "$archive_dir"/. ./bin/; \
rm -rf Futu_OpenD.tar.gz Futu_OpenD_*; \
chmod +x bin/FutuOpenD; \
ls ./bin

# If we `COPY --from=builder /usr/src/node_modules .`,
#   there will be no /usr/src/app/node_modules directory,
#   but all content of node_modules will be copied to WORKDIR
COPY --from=builder /usr/src/node_modules ./node_modules

# COPY ./src .
COPY . .

# Check if the node dependencies are ready
RUN ls -la ./node_modules \
&& node ./src/check.js \
&& rm ./src/check.js

ENV FUTU_LOGIN_ACCOUNT=
ENV FUTU_LOGIN_PWD_MD5=
# ENV FUTU_LOGIN_REGION=sh
ENV FUTU_LANG=en
ENV FUTU_LOG_LEVEL=no

# Use 0.0.0.0 by default so it could accept connections from other containers
ENV FUTU_IP=0.0.0.0
ENV FUTU_PORT=11111
ENV SERVER_PORT=8000
ENV FUTU_INIT_ON_START=yes
ENV FUTU_SUPERVISE_PROCESS=yes
ENV FUTU_CMD=/usr/src/app/bin/FutuOpenD

CMD [ "node", "/usr/src/app/src/start.js" ]
