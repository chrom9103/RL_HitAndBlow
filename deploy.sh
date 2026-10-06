#!/bin/bash

# Hit and Blow デプロイスクリプト
# 使用方法: ./deploy.sh
#
# 必要ファイル:
#   - infra/secrets/tls.crt (SSL証明書: サーバー証明書＋中間証明書のフルチェーン)
#   - infra/secrets/tls.key (SSL秘密鍵)
#
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

# 設定ファイルの存在を確認
echo ""
echo "[1/5] Checking required configuration files..."
TLS_CRT="$K8S_DIR/secrets/tls.crt"
TLS_KEY="$K8S_DIR/secrets/tls.key"
if [ ! -f "$TLS_CRT" ] || [ ! -f "$TLS_KEY" ]; then
  echo "❌ Error: $TLS_CRT or $TLS_KEY not found"
  exit 1
fi

# tls.crt がフルチェーン（サーバー証明書＋中間CA）を含んでいるか確認
CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" "$TLS_CRT" 2>/dev/null || echo 0)
if [ "$CERT_COUNT" -lt 2 ]; then
  echo "❌ Error: $TLS_CRT contains only $CERT_COUNT certificate(s)."
  echo "  tls.crt must be a full-chain certificate (server cert + intermediate CA certs)."
  echo "  Example (Let's Encrypt):"
  echo "    cat your-cert.crt your-certInt.crt > $TLS_CRT"
  exit 1
fi
echo "  ✓ tls.crt contains $CERT_COUNT certificates (full chain)"

# 証明書と秘密鍵がペアになっているか確認
if [ "$(openssl x509 -in "$TLS_CRT" -noout -pubkey | sha256sum)" != "$(openssl pkey -in "$TLS_KEY" -pubout | sha256sum)" ]; then
  echo "❌ Error: $TLS_CRT and $TLS_KEY do not match"
  exit 1
fi
echo "  ✓ tls.crt and tls.key match ($(openssl x509 -in "$TLS_CRT" -noout -enddate))"

# 1. Docker イメージをビルド
echo ""
echo "[2/5] Building Docker image..."
docker build -t "$IMAGE" -f "$DOCKERFILE" "$BUILD_CONTEXT"

# 2. MicroK8s のローカルレジストリ (localhost:32000) に push
echo ""
echo "[3/5] Pushing image to local registry..."
docker push "$IMAGE"

# 3. マニフェストを検証（クラスタを変更する前に kustomize / API のエラーを検出）
#    TLS Secret は kustomize の secretGenerator が作成し、Ingress の参照先も自動で切り替わるため、
#    事前に削除する必要はない
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
