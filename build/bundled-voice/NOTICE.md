# Bundled offline speech — third-party notices

Companio preview installers include an architecture-matched **whisper.cpp** CPU
executable and a quantized English Whisper model. These assets are provided
for push-to-talk transcription; Companio does not start recording at login.

- Engine: [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp),
  official release `b5454`. See [LICENSE-whisper.cpp.txt](LICENSE-whisper.cpp.txt).
- Model: [ggerganov/whisper.cpp GGML weights](https://huggingface.co/ggerganov/whisper.cpp),
  English base `ggml-base.en-q5_1.bin`, pinned model revision
  `c521a4b02f422512d734391fdf08bb08c0862f68`.
  Original Whisper licensing notice: [LICENSE-whisper-model.txt](LICENSE-whisper-model.txt).

The build downloads only the pinned upstream archives and verifies their
SHA-256 hashes before shipping them. The executables and model are not stored
in the Git repository. Upstream notices are retained in each installer.
These third-party components are not security-certified by Companio.
