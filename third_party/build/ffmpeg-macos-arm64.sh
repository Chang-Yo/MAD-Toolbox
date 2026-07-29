#!/bin/sh
set -eu

if test "$#" -ne 2; then
  echo "Usage: $0 /path/to/ffmpeg-8.1.2 /absolute/install/prefix" >&2
  exit 2
fi

source_directory="$1"
install_prefix="$2"

cd "$source_directory"
make distclean >/dev/null 2>&1 || true
./configure \
  --prefix="$install_prefix" \
  --arch=arm64 \
  --target-os=darwin \
  --cc=/usr/bin/clang \
  --enable-static \
  --disable-shared \
  --disable-debug \
  --disable-doc \
  --disable-htmlpages \
  --disable-manpages \
  --disable-podpages \
  --disable-txtpages \
  --disable-ffplay \
  --disable-sdl2 \
  --disable-libxcb \
  --disable-xlib \
  --enable-pic \
  --enable-videotoolbox \
  --enable-audiotoolbox \
  --enable-securetransport
make -j8
make install
