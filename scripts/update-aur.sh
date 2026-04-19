#!/usr/bin/env bash
# Updates packaging/aur/PKGBUILD with a new version + sha256 of the release
# AppImage, then regenerates .SRCINFO. Usage:
#
#   scripts/update-aur.sh <version>
#
# Version should not include the leading "v". Examples: 0.1.0, 0.2.0-rc1.
# Requires: curl, sha256sum, makepkg (pacman-contrib).

set -euo pipefail

version="${1:-}"
if [[ -z "$version" ]]; then
    echo "usage: $0 <version>" >&2
    exit 1
fi

cd "$(dirname "$0")/.."
aur_dir="packaging/aur"
pkgbuild="$aur_dir/PKGBUILD"
pkgname="nahida-desktop-linux"
appimage_url="https://github.com/Relained/${pkgname}/releases/download/v${version}/${pkgname}-${version}.AppImage"

echo "[update-aur] fetching AppImage to hash…"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fL --retry 3 -o "$tmp/app.AppImage" "$appimage_url"
app_sha=$(sha256sum "$tmp/app.AppImage" | awk '{print $1}')
desktop_sha=$(sha256sum "$aur_dir/${pkgname}.desktop" | awk '{print $1}')
license_sha=$(sha256sum LICENSE | awk '{print $1}')

echo "[update-aur] updating PKGBUILD…"
sed -i -E "s/^pkgver=.*/pkgver=${version}/" "$pkgbuild"
sed -i -E "s/^pkgrel=.*/pkgrel=1/" "$pkgbuild"

# Replace the entire sha256sums block (three entries).
python3 - "$pkgbuild" "$app_sha" "$desktop_sha" "$license_sha" <<'PY'
import re, sys
path, a, b, c = sys.argv[1:]
text = open(path).read()
new = f"sha256sums=('{a}'\n            '{b}'\n            '{c}')"
text = re.sub(r"sha256sums=\([^)]*\)", new, text, count=1)
open(path, "w").write(text)
PY

echo "[update-aur] regenerating .SRCINFO…"
(cd "$aur_dir" && makepkg --printsrcinfo > .SRCINFO)

echo "[update-aur] done. Review packaging/aur/ and commit."
