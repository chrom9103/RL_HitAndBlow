# ビルドコンテキストはリポジトリルート:
#   docker build -f infra/Dockerfile -t localhost:32000/hit-and-blow:v0.0.2 .
#   docker push localhost:32000/hit-and-blow:v0.0.2
#   microk8s kubectl apply -k infra
FROM node:lts-alpine AS builder

WORKDIR /app

COPY app/package*.json ./

RUN npm ci

COPY app/ .

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html/hit-and-blow

COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
