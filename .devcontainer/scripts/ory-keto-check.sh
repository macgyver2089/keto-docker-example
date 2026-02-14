#!/bin/bash
# Helper script to run Ory CLI commands against the local Keto instance
# Usage: ory-keto-check alice view Document architecture-design.pdf

if [ $# -lt 3 ]; then
  echo "Usage: ory-keto-check <subject> <relation> <namespace> <object>"
  echo "Example: ory-keto-check alice view Document architecture-design.pdf"
  exit 1
fi

SUBJECT=$1
RELATION=$2
NAMESPACE=$3
OBJECT=$4

ory check permission \
  --endpoint http://localhost:4466 \
  --namespace "$NAMESPACE" \
  --object "$OBJECT" \
  --relation "$RELATION" \
  --subject-id "$SUBJECT" \
  --skip-tls-verify
