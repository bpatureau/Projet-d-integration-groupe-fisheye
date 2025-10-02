#!/bin/bash

# Vérifier que Go est installé
if ! command -v go &> /dev/null; then
    echo "Erreur: Go n'est pas installé"
    exit 1
fi

# Afficher l'usage si pas d'argument
if [ -z "$1" ]; then
    echo "Usage: ./build.sh [PLATFORM]"
    echo ""
    echo "Plateformes disponibles:"
    echo "  windows-amd64, windows-386, windows-arm64"
    echo "  linux-amd64, linux-386, linux-arm64, linux-arm"
    echo "  darwin-amd64, darwin-arm64"
    echo "  rpi-arm64, rpi-arm32, rpi-armv6"
    echo ""
    exit 1
fi

DIST_DIR="../dist"
LDFLAGS="-s -w"

# Récupérer la version depuis git
VERSION=$(git describe --tags --always 2>/dev/null || echo "dev")
LDFLAGS="$LDFLAGS -X main.Version=$VERSION"

# Créer le dossier dist s'il n'existe pas
mkdir -p "$DIST_DIR"

PLATFORM="$1"

# Configuration selon la plateforme
case "$PLATFORM" in
    # Windows
    windows-amd64)
        GOOS=windows GOARCH=amd64 GOARM=
        OUTPUT="$DIST_DIR/fisheye-windows-amd64.exe"
        ;;
    windows-386)
        GOOS=windows GOARCH=386 GOARM=
        OUTPUT="$DIST_DIR/fisheye-windows-386.exe"
        ;;
    windows-arm64)
        GOOS=windows GOARCH=arm64 GOARM=
        OUTPUT="$DIST_DIR/fisheye-windows-arm64.exe"
        ;;
    
    # Linux
    linux-amd64)
        GOOS=linux GOARCH=amd64 GOARM=
        OUTPUT="$DIST_DIR/fisheye-linux-amd64"
        ;;
    linux-386)
        GOOS=linux GOARCH=386 GOARM=
        OUTPUT="$DIST_DIR/fisheye-linux-386"
        ;;
    linux-arm64)
        GOOS=linux GOARCH=arm64 GOARM=
        OUTPUT="$DIST_DIR/fisheye-linux-arm64"
        ;;
    linux-arm)
        GOOS=linux GOARCH=arm GOARM=7
        OUTPUT="$DIST_DIR/fisheye-linux-arm"
        ;;
    
    # macOS
    darwin-amd64)
        GOOS=darwin GOARCH=amd64 GOARM=
        OUTPUT="$DIST_DIR/fisheye-darwin-amd64"
        ;;
    darwin-arm64)
        GOOS=darwin GOARCH=arm64 GOARM=
        OUTPUT="$DIST_DIR/fisheye-darwin-arm64"
        ;;
    
    # Raspberry Pi
    rpi-arm64)
        GOOS=linux GOARCH=arm64 GOARM=
        OUTPUT="$DIST_DIR/fisheye-rpi-arm64"
        ;;
    rpi-arm32)
        GOOS=linux GOARCH=arm GOARM=7
        OUTPUT="$DIST_DIR/fisheye-rpi-arm32"
        ;;
    rpi-armv6)
        GOOS=linux GOARCH=arm GOARM=6
        OUTPUT="$DIST_DIR/fisheye-rpi-armv6"
        ;;
    
    *)
        echo "Plateforme inconnue: $PLATFORM"
        exit 1
        ;;
esac

echo "Build: $PLATFORM (version $VERSION)"

# Compiler
start_time=$(date +%s)
CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH GOARM=$GOARM go build -ldflags="$LDFLAGS" -o "$OUTPUT" main.go

if [ $? -eq 0 ]; then
    sizeMB=$(du -m "$OUTPUT" | cut -f1)
    end_time=$(date +%s)
    elapsed=$((end_time - start_time))
    
    echo "Succès - ${sizeMB} MB - ${elapsed}s"
else
    echo "Erreur de compilation"
    exit 1
fi

exit 0