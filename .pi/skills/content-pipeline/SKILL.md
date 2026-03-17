---
name: content-pipeline
description: |
  Full YouTube content pipeline: raw video → transcript → edits → EDL → render → shorts.

  USE FOR:
  - Transcribing and editing a new raw video recording
  - Rendering long-form YouTube video with intro/outro overlays and captions
  - Extracting and rendering viral moment shorts (9:16 vertical)
  - Running any single step of the pipeline independently

  TRIGGER when user says: "run the content pipeline", "process my video", "create shorts from", "transcribe this video"
allowed-tools:
  - Bash(python tools/transcribe_video.py *)
  - Bash(python tools/detect_edits.py *)
  - Bash(python tools/generate_edl.py *)
  - Bash(python tools/enhance_edl.py *)
  - Bash(python tools/process_video.py *)
  - Bash(python tools/render_video.py *)
  - Bash(python tools/extract_viral_moments.py *)
  - Bash(python tools/render_short.py *)
---

# Content Pipeline Skill

Full-stack content pipeline for processing raw videos into YouTube Shorts and long-form content with overlays, captions, and AI-powered insights.

## Prerequisites

### System Dependencies
- **FFmpeg**: `ffmpeg -version` (for cutting, normalization, concatenation)
- **Node.js 18+**: `node -v` (for Remotion rendering)
- **Python 3.11+**: `python3 --version`

### Python Dependencies
```bash
pip install -r requirements.txt
```

### API Keys (Required)
Set these in `.env` after copying `.env.example`:
- `ANTHROPIC_API_KEY` — Claude API for EDL enhancement and analysis
- `OPENAI_API_KEY` — OpenAI Whisper for video transcription
- `PEXELS_API_KEY` — Optional, for stock B-roll sourcing

### Setup on New Machine
```bash
git clone https://github.com/charlescooperiii/youtube-content-pipeline
cd youtube-content-pipeline

# Install Python dependencies
pip install -r requirements.txt

# Install Remotion project dependencies
cd remotion
npm install
cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Customize branding
# 1. Replace remotion/public/logos/logo.png with your logo
# 2. Edit config/brand.json with your channel name, colors, and info

# Verify setup
ffmpeg -version
node --version
python3 -c "import anthropic; print('✓ Ready to process videos!')"
```

---

## Quick Start — Full Pipeline (One Command)

```bash
VIDEO_PATH="Youtube_Videos/raw/my_video.mp4"
VIDEO_NAME="my_video"   # used for output file naming

# Dry-run (estimate cost, no API calls)
python tools/transcribe_video.py "$VIDEO_PATH" --dry-run

# Run full pipeline
python tools/transcribe_video.py "$VIDEO_PATH" --output ".tmp/transcript_${VIDEO_NAME}.json" && \
python tools/detect_edits.py --input "$VIDEO_PATH" --transcript ".tmp/transcript_${VIDEO_NAME}.json" --output ".tmp/edit_decisions_${VIDEO_NAME}.json" && \
python tools/generate_edl.py --transcript ".tmp/transcript_${VIDEO_NAME}.json" --edits ".tmp/edit_decisions_${VIDEO_NAME}.json" --output ".tmp/edl_${VIDEO_NAME}.json" && \
python tools/enhance_edl.py --edl ".tmp/edl_${VIDEO_NAME}.json" --style conversational && \
python tools/process_video.py --input "$VIDEO_PATH" --edl ".tmp/edl_${VIDEO_NAME}.json" --output ".tmp/renders/${VIDEO_NAME}_processed.mp4" && \
python tools/render_video.py --edl ".tmp/edl_${VIDEO_NAME}.json" --processed ".tmp/renders/${VIDEO_NAME}_processed.mp4" && \
python tools/extract_viral_moments.py --transcript ".tmp/transcript_${VIDEO_NAME}.json" && \
python tools/render_short.py batch --moments ".tmp/viral_moments_$(date +%Y-%m-%d).json" --video "public/source_video.mp4"
```

**Output:**
- `.tmp/renders/{name}_final.mp4` — Long-form video (ready to upload)
- `.tmp/shorts/00_*.mp4` through `.tmp/shorts/04_*.mp4` — 5 viral shorts (9:16 vertical)

---

## Step-by-Step Instructions

### Step 1 — Transcribe

```bash
python tools/transcribe_video.py \
  --input "Youtube_Videos/raw/my_video.mp4" \
  --output ".tmp/transcript_my_video.json"
```

**Output:** `.tmp/transcript_my_video.json` with word-level timestamps and full text.

### Step 2 — Detect Edits

```bash
python tools/detect_edits.py \
  --input "Youtube_Videos/raw/my_video.mp4" \
  --transcript ".tmp/transcript_my_video.json" \
  --output ".tmp/edit_decisions_my_video.json"
```

**Output:** Edit decisions (silence, fillers, cut/speed recommendations).

### Step 3 — Generate EDL

```bash
python tools/generate_edl.py \
  --transcript ".tmp/transcript_my_video.json" \
  --edits ".tmp/edit_decisions_my_video.json" \
  --output ".tmp/edl_my_video.json"
```

**Output:** Full edit decision list with caption placement and overlay config.

### Step 3.5 — Enhance EDL (Optional — Claude AI)

```bash
python tools/enhance_edl.py \
  --edl ".tmp/edl_my_video.json" \
  --style conversational
```

**Output:** B-roll suggestions and chapter markers added to EDL.

### Step 4 — Process Video

```bash
python tools/process_video.py \
  --input "Youtube_Videos/raw/my_video.mp4" \
  --edl ".tmp/edl_my_video.json" \
  --output ".tmp/renders/my_video_processed.mp4"
```

**Output:** Edited, cuts applied, audio normalized (no overlays yet).

### Step 5 — Render Final Video

```bash
python tools/render_video.py \
  --edl ".tmp/edl_my_video.json" \
  --processed ".tmp/renders/my_video_processed.mp4"
```

**Output:** `.tmp/renders/my_video_final.mp4` with intro, captions, overlays, outro.

### Step 6 — Extract & Render Viral Shorts

```bash
# Extract moments using Claude
python tools/extract_viral_moments.py \
  --transcript ".tmp/transcript_my_video.json"

# Copy source video to Remotion public/ (needed for rendering)
cp "Youtube_Videos/raw/my_video.mp4" "remotion/public/source_video.mp4"

# Render 5 shorts (9:16 vertical)
python tools/render_short.py batch \
  --moments ".tmp/viral_moments_$(date +%Y-%m-%d).json" \
  --video "public/source_video.mp4"
```

**Output:** `.tmp/shorts/00_*.mp4` through `.tmp/shorts/04_*.mp4` (5 clips).

---

## Customization

### Edit Your Branding
Edit `config/brand.json` to customize:
- `channel_name` — Your channel/creator name
- `colors` — Primary, secondary, accent, text colors
- `lower_third.default_name` — Your name for overlays
- `lower_third.default_title` — Your title
- `subscribe_cta.channel_name` — Channel name for subscribe CTA

### Replace the Logo
Copy your logo to `remotion/public/logos/logo.png`. It will be used in the intro animation.

### Change Compositions
Edit `remotion/src/LongForm/IntroScene.tsx` for custom intro animations, or `remotion/src/Shorts/ShortsTemplate.tsx` for shorts styling.

---

## Output Files Reference

| File | Purpose | Location |
|------|---------|----------|
| `transcript_{name}.json` | Word-level transcript + full text | `.tmp/` |
| `edit_decisions_{name}.json` | Silences, fillers, cuts | `.tmp/` |
| `edl_{name}.json` | Full segment list + captions + overlays | `.tmp/` |
| `broll_suggestions_{name}.json` | Stock video recommendations | `.tmp/` |
| `viral_moments_{date}.json` | 5 viral clip timestamps + scores | `.tmp/` |
| `renders/{name}_processed.mp4` | Edited + normalized (no overlays) | `.tmp/renders/` |
| `renders/{name}_final.mp4` | Final with intro/outro/captions | `.tmp/renders/` |
| `shorts/00_*.mp4` to `04_*.mp4` | 5 shorts (9:16 vertical) | `.tmp/shorts/` |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `KeyError: 'text_primary'` in generate_edl.py | Brand config missing color keys. Check `config/brand.json`. |
| `openai.APIError` | Verify `OPENAI_API_KEY` in `.env` is valid. |
| `anthropic.APIError` | Verify `ANTHROPIC_API_KEY` in `.env` is valid. |
| Shorts render fails with "404 file not found" | Copy source video to Remotion public/: `cp source.mp4 remotion/public/source_video.mp4` |
| FFmpeg not found | Install FFmpeg: `brew install ffmpeg` (Mac) or download from ffmpeg.org |
| Node.js not found | Install Node 18+: `brew install node` or nvm |
| Remotion version mismatch warning | Run `cd remotion && npm install` to reinstall with pinned versions |

---

## Notes & Limits

- **Transcription cost:** ~$0.025 per minute (OpenAI Whisper)
- **Claude enhancement cost:** ~$0.10-0.30 per video (EDL + moments)
- **Video duration:** Tested up to 45 minutes; longer may timeout
- **Shorts format:** 9:16 vertical, 25-37 seconds, optimized for YouTube Shorts/TikTok/Reels
- **Storage:** Each full pipeline run generates ~500 MB in `.tmp/` (can be deleted after upload)

---

## Example Workflow

```bash
# 1. Place your raw video
mkdir -p Youtube_Videos/raw
cp ~/my_recording.mp4 Youtube_Videos/raw/

# 2. Run full pipeline
VIDEO_PATH="Youtube_Videos/raw/my_recording"
VIDEO_NAME="my_recording"

python tools/transcribe_video.py "$VIDEO_PATH.mp4" --output ".tmp/transcript_${VIDEO_NAME}.json"
# ... [remaining steps from Quick Start above]

# 3. Upload final video
open .tmp/renders/${VIDEO_NAME}_final.mp4  # Check in player
# Upload to YouTube

# 4. Upload shorts
open .tmp/shorts/  # Review the 5 clips
# Upload to YouTube Shorts, TikTok, Instagram Reels

# 5. Clean up temporary files
rm -rf .tmp/
```

---

## Questions or Issues?

- Check the troubleshooting table above
- Verify all API keys are set in `.env`
- Run `python tools/{tool_name} --help` for tool-specific options
- Ensure FFmpeg and Node.js are installed and in PATH
