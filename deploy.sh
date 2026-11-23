#!/bin/bash

# Hit and Blow デプロイスクリプト
# 使用方法: ./deploy.sh
# イメージ名とタグは infra/deployment.yaml の image から取得します。
# アプリを更新したときにタグを上げる場合は、deployment.yaml の image を書き換えてください。

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

K8S_DIR="infra"
DEPLOYMENT="hit-and-blow-deployment"
INGRESS="hit-and-blow-ingress"
DOCKERFILE="infra/Dockerfile"
BUILD_CONTEXT="."
IMAGE=$(grep -m1 -E '^[[:space:]]*image:' "$K8S_DIR/deployment.yaml" | awk '{print $2}')

if [ -z "$IMAGE" ]; then
  echo "❌ Error: image not found in $K8S_DIR/deployment.yaml"
  exit 1
fi

echo "=========================================="
echo "Deploying Hit and Blow - Image: $IMAGE"
echo "=========================================="

# TLS 証明書を確認
# 証明書は chrom9103/k8s-certs の cert-manager が管理する共有 Secret chrom-jp-tls（Certificate chrom-jp）を使う。
echo ""
echo "[1/5] Checking TLS certificate managed by cert-manager..."
if ! microk8s kubectl wait --for=condition=Ready certificate/chrom-jp --timeout=60s > /dev/null 2>&1; then
  echo "❌ Error: Certificate chrom-jp is not Ready (k8s-certs リポジトリを適用済みか確認してください)"
  exit 1
fi
echo "  ✓ Certificate chrom-jp is Ready"

# 1. Docker イメージをビルド
echo ""
echo "[2/5] Building Docker image..."
docker build -t "$IMAGE" -f "$DOCKERFILE" "$BUILD_CONTEXT"

# 2. MicroK8s のローカルレジストリ (localhost:32000) に push
echo ""
echo "[3/5] Pushing image to local registry..."
docker push "$IMAGE"

# 3. マニフェストを検証（クラスタを変更する前に kustomize / API のエラーを検出）
echo ""
echo "[4/5] Validating Kubernetes manifests (server-side dry-run)..."
microk8s kubectl apply -k "$K8S_DIR/" --dry-run=server > /dev/null
echo "  ✓ Manifests are valid"

# 4. Kubernetes にデプロイし、新しいイメージで Pod を再起動
echo ""
echo "[5/5] Deploying to Kubernetes..."
microk8s kubectl apply -k "$K8S_DIR/"
microk8s kubectl rollout restart deployment/$DEPLOYMENT
microk8s kubectl rollout status deployment/$DEPLOYMENT --timeout=5m || {
  echo "⚠ Timeout waiting for $DEPLOYMENT"
}

# Ingress が参照している TLS Secret を確認
echo ""
echo "Verifying TLS Secret..."
TLS_SECRET=$(microk8s kubectl get ingress "$INGRESS" -o jsonpath='{.spec.tls[0].secretName}' 2>/dev/null || echo "")
if [ -z "$TLS_SECRET" ]; then
  echo "⚠ Warning: TLS Secret for $INGRESS not found"
else
  echo "✓ TLS Secret verified: $TLS_SECRET"
  CERT_INFO=$(microk8s kubectl get secret "$TLS_SECRET" -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d | openssl x509 -noout -subject -enddate 2>/dev/null || echo "N/A")
  echo "  Certificate: $CERT_INFO"
fi

echo ""
echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Access the application: https://www.chrom.jp/hit-and-blow/"
