#!/usr/bin/env bash
# One-time setup for Bangla voice-over used by tools/reel.py
set -e
pip install --break-system-packages -q sherpa-onnx soundfile
mkdir -p ~/.tts && cd ~/.tts
if [ ! -f vits-coqui-bn-custom_female/model.onnx ]; then
  curl -sL -o m.tar.bz2 https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-coqui-bn-custom_female.tar.bz2
  tar xjf m.tar.bz2 && rm m.tar.bz2
fi
echo "TTS ready: ~/.tts/vits-coqui-bn-custom_female"
