# YouTube Content Pipeline

**Automate your entire YouTube content workflow**: transcribe → edit → render with AI-powered graphics → create viral shorts.

Process raw videos into publication-ready long-form content and 9:16 vertical shorts using Claude, OpenAI, FFmpeg, and Remotion.

## Features

✅ **Transcription** — Word-level timestamps via OpenAI Whisper
✅ **Smart Editing** — Auto-detect silence, filler words, and cut recommendations
✅ **AI Enhancement** — Claude-powered B-roll suggestions and chapter markers
✅ **Professional Rendering** — Intro/outro overlays, captions, lower thirds (Remotion)
✅ **Viral Shorts** — Auto-extract 5 high-engagement moments and render 9:16 vertical clips
✅ **Customizable** — Easy branding, colors, fonts, animations

## Quick Setup

### Prerequisites

- **System:** FFmpeg, Node.js 18+, Python 3.11+
- **API Keys:** Anthropic (Claude), OpenAI
- **Optional:** Pexels API for stock B-roll

### Installation

```bash
git clone https://github.com/yourusername/youtube-content-pipeline
cd youtube-content-pipeline

# Install Python dependencies
pip install -r requirements.txt

# Install Remotion (video rendering)
cd remotion
npm install
cd ..

# Set up API keys
cp .env.example .env
# Edit .env with your API keys

# Customize your branding
# 1. Replace remotion/public/logos/logo.png with your logo
# 2. Edit config/brand.json with your channel name, colors, info
```

### Verify Setup

```bash
ffmpeg -version
node -v
python3 -c "import anthropic; print('✓ Setup complete!')"
```

## Usage

### Full Pipeline (Fastest Way)

```bash
# Place your raw video
cp my_recording.mp4 Youtube_Videos/raw/

# Run everything
VIDEO_PATH="Youtube_Videos/raw/my_recording.mp4"
VIDEO_NAME="my_recording"

python tools/transcribe_video.py "$VIDEO_PATH" --output ".tmp/transcript_${VIDEO_NAME}.json" && \
python tools/detect_edits.py --input "$VIDEO_PATH" --transcript ".tmp/transcript_${VIDEO_NAME}.json" --output ".tmp/edit_decisions_${VIDEO_NAME}.json" && \
python tools/generate_edl.py --transcript ".tmp/transcript_${VIDEO_NAME}.json" --edits ".tmp/edit_decisions_${VIDEO_NAME}.json" --output ".tmp/edl_${VIDEO_NAME}.json" && \
python tools/enhance_edl.py --edl ".tmp/edl_${VIDEO_NAME}.json" --style conversational && \
python tools/process_video.py --input "$VIDEO_PATH" --edl ".tmp/edl_${VIDEO_NAME}.json" --output ".tmp/renders/${VIDEO_NAME}_processed.mp4" && \
python tools/render_video.py --edl ".tmp/edl_${VIDEO_NAME}.json" --processed ".tmp/renders/${VIDEO_NAME}_processed.mp4" && \
python tools/extract_viral_moments.py --transcript ".tmp/transcript_${VIDEO_NAME}.json" && \
cp "$VIDEO_PATH" "remotion/public/source_video.mp4" && \
python tools/render_short.py batch --moments ".tmp/viral_moments_$(date +%Y-%m-%d).json" --video "public/source_video.mp4"
```

**Outputs:**
- `.tmp/renders/{name}_final.mp4` — Ready to upload to YouTube
- `.tmp/shorts/00_*.mp4` to `.tmp/shorts/04_*.mp4` — 5 shorts for YouTube Shorts/TikTok/Reels

### Individual Steps

See [.pi/skills/content-pipeline/SKILL.md](.pi/skills/content-pipeline/SKILL.md) for detailed step-by-step instructions.

## File Structure

```
youtube-content-pipeline/
├── tools/                    # 9 pipeline scripts
├── remotion/                 # Remotion project (rendering engine)
│   ├── src/LongForm/        # Long-form video compositions
│   ├── src/Shorts/          # Shorts (9:16) compositions
│   └── public/              # Static assets (sounds, logos)
├── config/brand.json        # Your branding (edit this!)
├── .env.example             # Copy to .env and fill with API keys
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

## Configuration

### Customize Branding

Edit `config/brand.json`:

```json
{
  "channel_name": "Your Channel Name",
  "colors": {
    "primary": "#FFD700",
    "accent": "#FF0000",
    "text_primary": "#FFFFFF"
  },
  "lower_third": {
    "default_name": "Your Name",
    "default_title": "Creator"
  }
}
```

### Update Your Logo

Replace `remotion/public/logos/logo.png` with your logo (PNG recommended).

### Customize Intro/Outro

Edit `remotion/src/LongForm/IntroScene.tsx` for intro animations or `remotion/src/LongForm/OutroScene.tsx` for outros.

## Cost Estimates

| Step | Provider | Cost |
|------|----------|------|
| Transcription (60 min) | OpenAI Whisper | ~$0.025 |
| AI Enhancement | Anthropic Claude | ~$0.10-0.30 |
| B-Roll Sourcing | Pexels | Free |
| Rendering | Local (FFmpeg + Remotion) | Free |
| **Total per video** | | **~$0.15-0.35** |

## Tools Reference

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `transcribe_video.py` | Word-level transcription | MP4/MOV | JSON with timestamps |
| `detect_edits.py` | Find cuts, silences, fillers | MP4 + transcript | Edit decisions JSON |
| `generate_edl.py` | Create edit decision list | Transcript + edits | Full EDL JSON |
| `enhance_edl.py` | AI suggestions (Claude) | EDL JSON | Enhanced EDL + B-roll suggestions |
| `fetch_broll.py` | Download stock clips | EDL JSON | Downloaded clips |
| `process_video.py` | Apply cuts & normalize audio | MP4 + EDL | Processed MP4 |
| `render_video.py` | Add overlays & compose | Processed MP4 + EDL | Final MP4 with graphics |
| `extract_viral_moments.py` | Find viral clips (Claude) | Transcript JSON | Viral moments JSON |
| `render_short.py` | Render 9:16 vertical shorts | Source MP4 + moments | 5 short MP4 files |

## Troubleshooting

**"ModuleNotFoundError: No module named 'anthropic'"**
```bash
pip install -r requirements.txt
```

**"FFmpeg not found"**
```bash
# Mac
brew install ffmpeg

# Linux
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

**"Cannot find Remotion project"**
```bash
cd remotion
npm install
cd ..
```

**"Video render fails: 404 source not found"**
```bash
# Remotion needs the video in public/ folder
cp "Youtube_Videos/raw/my_video.mp4" "remotion/public/source_video.mp4"
```

**"OpenAI/Anthropic API errors"**
- Check `.env` has valid API keys
- Verify keys haven't expired
- Check account has available credits

See [.pi/skills/content-pipeline/SKILL.md](.pi/skills/content-pipeline/SKILL.md) for more troubleshooting.

## Using with Claude Code

1. Clone the repo to your local machine
2. Open it in [Claude Code](https://claude.com/claude-code)
3. Ask: *"Run the content pipeline on my_video.mp4"*

Claude will orchestrate the entire workflow using the SKILL file.

## Examples

### Basic Workflow

```bash
# 1. Add your video
mkdir -p Youtube_Videos/raw
cp ~/my_talk.mp4 Youtube_Videos/raw/

# 2. Run pipeline (copy the full command from Quick Setup above)
# ... [running]

# 3. Check output
open .tmp/renders/my_talk_final.mp4
open .tmp/shorts/

# 4. Upload
# Long-form: YouTube
# Shorts: YouTube Shorts, TikTok, Instagram Reels, Snapchat
```

### Customize for Your Brand

```bash
# 1. Replace logo
cp ~/my_logo.png remotion/public/logos/logo.png

# 2. Update brand config
nano config/brand.json
# Change: channel_name, colors, lower_third.default_name/title

# 3. Re-run pipeline
# Your videos now have your branding!
```

## Performance

| Metric | Time |
|--------|------|
| Transcribe (30 min video) | ~2-3 minutes |
| Detect edits | ~1 minute |
| Generate EDL | ~30 seconds |
| Enhance (Claude) | ~1 minute |
| Process video (cuts + audio) | ~5-10 minutes |
| Render final (intro/captions) | ~10-15 minutes |
| Extract shorts + render (5 clips) | ~5 minutes |
| **Total end-to-end** | **~30-40 minutes** |

## Limitations

- Max video duration: ~45 minutes (longer may timeout on cloud APIs)
- Shorts: 5 viral moments extracted per video
- Audio normalization: -14 LUFS standard
- Captions: Auto-generated from transcript (review before publishing)

## License

MIT — Use freely, modify, share.

## Contributing

Improvements welcome! Submit issues or pull requests.

## Questions?

- See [.pi/skills/content-pipeline/SKILL.md](.pi/skills/content-pipeline/SKILL.md) for detailed docs
- Check [Troubleshooting](#troubleshooting) above
- Open an issue on GitHub

---

**Made with ❤️ for content creators by [Charles Cooper](https://github.com/charlescooperiii)**
