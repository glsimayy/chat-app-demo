# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
ARG REACT_APP_API_URL=/api
ARG REACT_APP_SOCKET_URL=/chat
ARG REACT_APP_WEBRTC_ICE_SERVERS=[{\"urls\":\"stun:stun.l.google.com:19302\"}]
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_SOCKET_URL=${REACT_APP_SOCKET_URL}
ENV REACT_APP_WEBRTC_ICE_SERVERS=${REACT_APP_WEBRTC_ICE_SERVERS}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/build /usr/share/nginx/html

EXPOSE 8080
