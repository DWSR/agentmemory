ARG III_VERSION=0.18.0

FROM iiidev/iii:${III_VERSION} AS iii-image

FROM oven/bun:1.3.13-slim

ARG AGENTMEMORY_VERSION=0.9.29
ARG III_VERSION=0.18.0
ARG III_SDK_VERSION=0.18.0

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini gosu curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=iii-image /app/iii /usr/local/bin/iii

# Install agentmemory into a dedicated prefix so the local package.json's
# `overrides` field pins iii-sdk down to match the engine. Global Bun
# installs ignore overrides, hence the local prefix.
WORKDIR /opt/agentmemory
RUN printf '{"name":"agentmemory-deploy","version":"1.0.0","private":true,"overrides":{"iii-sdk":"%s"}}\n' "${III_SDK_VERSION}" > package.json \
  && bun add --no-save --production "@agentmemory/agentmemory@${AGENTMEMORY_VERSION}" \
 && ln -s /opt/agentmemory/node_modules/.bin/agentmemory /usr/local/bin/agentmemory

ENV AGENTMEMORY_III_VERSION=${III_VERSION} \
    TINI_SUBREAPER=1

COPY --chmod=0755 entrypoint.sh /usr/local/bin/agentmemory-entrypoint.sh

EXPOSE 3111

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/agentmemory-entrypoint.sh"]
