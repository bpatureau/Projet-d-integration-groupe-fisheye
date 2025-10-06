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
    echo "  Windows:"
    echo "    windows-amd64, windows-386, windows-arm64"
    echo "  Linux:"
    echo "    linux-amd64, linux-386, linux-arm64"
    echo "    linux-armv7, linux-armv6, linux-armv5"
    echo "  macOS:"
    echo "    darwin-amd64, darwin-arm64"
    echo "  Raspberry Pi:"
    echo "    rpi-arm64, rpi-armv7, rpi-armv6"
    echo "  Special:"
    echo "    all (compile pour toutes les plateformes)"
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

# Fonction pour compiler une plateforme
build_platform() {
    local PLATFORM="$1"
    local GOOS GOARCH GOARM OUTPUT
    
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
        linux-armv7)
            GOOS=linux GOARCH=arm GOARM=7
            OUTPUT="$DIST_DIR/fisheye-linux-armv7"
            ;;
        linux-armv6)
            GOOS=linux GOARCH=arm GOARM=6
            OUTPUT="$DIST_DIR/fisheye-linux-armv6"
            ;;
        linux-armv5)
            GOOS=linux GOARCH=arm GOARM=5
            OUTPUT="$DIST_DIR/fisheye-linux-armv5"
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
        
        # Raspberry Pi (aliases pour plus de clarté)
        rpi-arm64)
            GOOS=linux GOARCH=arm64 GOARM=
            OUTPUT="$DIST_DIR/fisheye-rpi-arm64"
            ;;
        rpi-armv7)
            GOOS=linux GOARCH=arm GOARM=7
            OUTPUT="$DIST_DIR/fisheye-rpi-armv7"
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
            return 1
            ;;
    esac
    
    echo -n "[$PLATFORM] Build en cours... (version $VERSION) "
    
    # Compiler
    local start_time=$(date +%s)
    CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH GOARM=$GOARM go build -ldflags="$LDFLAGS" -o "$OUTPUT" main.go 2>/dev/null
    
    if [ $? -eq 0 ]; then
        local end_time=$(date +%s)
        local elapsed=$((end_time - start_time))
        
        # Calculer la taille du fichier
        local size_bytes=$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null)
        local size_kb=$((size_bytes / 1024))
        local size_mb=$((size_bytes / 1048576))
        
        # Afficher la taille appropriée
        if [ $size_mb -ge 1 ]; then
            echo "✓ Succès - ${size_mb} MB - ${elapsed}s"
        else
            echo "✓ Succès - ${size_kb} KB - ${elapsed}s"
        fi
        return 0
    else
        echo "✗ Erreur de compilation"
        return 1
    fi
}

PLATFORM="$1"

# Cas spécial: compiler pour toutes les plateformes
if [ "$PLATFORM" = "all" ]; then
    echo "Building for all platforms..."
    echo ""
    
    failed=0
    build_platform windows-amd64 || ((failed++))
    build_platform windows-386 || ((failed++))
    build_platform windows-arm64 || ((failed++))
    build_platform linux-amd64 || ((failed++))
    build_platform linux-386 || ((failed++))
    build_platform linux-arm64 || ((failed++))
    build_platform linux-armv7 || ((failed++))
    build_platform linux-armv6 || ((failed++))
    build_platform darwin-amd64 || ((failed++))
    build_platform darwin-arm64 || ((failed++))
    
    echo ""
    if [ $failed -eq 0 ]; then
        echo "✓ Toutes les compilations terminées avec succès!"
        exit 0
    else
        echo "✗ $failed compilation(s) échouée(s)"
        exit 1
    fi
else
    build_platform "$PLATFORM"
    exit $?
fi