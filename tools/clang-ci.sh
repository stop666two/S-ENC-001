#!/usr/bin/env bash
set -e
args=()
prev_was_target=0
has_target=0
for a in "$@"; do
  if [ "$prev_was_target" = "1" ]; then
    case "$a" in
      wasm32-unknown-unknown) args+=("wasm32-freestanding") ;;
      x86_64-pc-windows-gnu) args+=("x86_64-windows-gnu") ;;
      *) args+=("$a") ;;
    esac
    prev_was_target=0
    has_target=1
  elif [ "$a" = "--target" ] || [ "$a" = "-target" ]; then
    args+=("$a")
    prev_was_target=1
  else
    case "$a" in
      --target=wasm32-unknown-unknown) has_target=1; args+=("--target=wasm32-freestanding") ;;
      --target=x86_64-pc-windows-gnu) has_target=1; args+=("--target=x86_64-windows-gnu") ;;
      --target=*|-target=*) has_target=1; args+=("$a") ;;
      wasm32-unknown-unknown) args+=("wasm32-freestanding") ;;
      x86_64-pc-windows-gnu) args+=("x86_64-windows-gnu") ;;
      *) args+=("$a") ;;
    esac
  fi
done
if [ "$has_target" = "0" ]; then
  exec zig cc --target=wasm32-freestanding "${args[@]}"
fi
exec zig cc "${args[@]}"
