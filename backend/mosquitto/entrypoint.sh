#!/bin/sh
set -e

# =================================================================
# 1. User & Password Setup
# =================================================================
if [ -z "$MQTT_USERNAME" ] || [ -z "$MQTT_PASSWORD" ]; then
  echo "⚠️  MQTT_USERNAME or MQTT_PASSWORD not set. Using default: admin / password"
  MQTT_USERNAME=${MQTT_USERNAME:-admin}
  MQTT_PASSWORD=${MQTT_PASSWORD:-password}
fi

echo "🔐 Creating password file for user: $MQTT_USERNAME"
# -c: Create a new password file (overwrites existing)
# -b: Batch mode (username password on command line)
mosquitto_passwd -c -b /mosquitto/config/passwd "$MQTT_USERNAME" "$MQTT_PASSWORD"

# Set permissions
chown mosquitto:mosquitto /mosquitto/config/passwd
chmod 0700 /mosquitto/config/passwd

# =================================================================
# 2. SSL/TLS Certificate Generation (Self-Signed)
# =================================================================
CERTS_DIR="/mosquitto/certs"
mkdir -p "$CERTS_DIR"

if [ ! -f "$CERTS_DIR/server.crt" ]; then
    echo "📜 Generating self-signed SSL certificates..."
    
    # Generate CA
    openssl req -new -x509 -days 3650 -extensions v3_ca -keyout "$CERTS_DIR/ca.key" -out "$CERTS_DIR/ca.crt" -nodes -subj "/CN=Fisheye CA"
    
    # Generate Server Key
    openssl genrsa -out "$CERTS_DIR/server.key" 2048
    
    # Generate Server CSR
    openssl req -new -out "$CERTS_DIR/server.csr" -key "$CERTS_DIR/server.key" -nodes -subj "/CN=localhost"
    
    # Sign Server CSR
    openssl x509 -req -in "$CERTS_DIR/server.csr" -CA "$CERTS_DIR/ca.crt" -CAkey "$CERTS_DIR/ca.key" -CAcreateserial -out "$CERTS_DIR/server.crt" -days 3650
    
    # Cleanup
    rm "$CERTS_DIR/server.csr"
    
    # Set permissions
    chown -R mosquitto:mosquitto "$CERTS_DIR"
    chmod 600 "$CERTS_DIR/server.key" "$CERTS_DIR/ca.key"
    
    echo "✅ Certificates generated."
else
    echo "ℹ️  Certificates already exist."
fi

# =================================================================
# 3. Start Mosquitto
# =================================================================
echo "🚀 Starting Mosquitto..."
exec "$@"
