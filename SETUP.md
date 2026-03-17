# Getting Started (5 minutes)

## Step 1: Clone the Repo

```bash
git clone https://github.com/treycooper3/youtube-content-pipeline
cd youtube-content-pipeline
```

## Step 2: Install Dependencies

```bash
# Python packages
pip install -r requirements.txt

# Remotion (video rendering)
cd remotion
npm install
cd ..
```

If `npm install` fails, ensure Node.js 18+ is installed:
```bash
# Check your version
node --version

# If needed, install Node
# Mac: brew install node
# Or use nvm: https://github.com/nvm-sh/nvm
```

## Step 3: Set Up API Keys

```bash
# Copy the template
cp .env.example .env

# Edit it with your keys (use your preferred editor)
nano .env
```

You need:
- **ANTHROPIC_API_KEY** — Get from https://console.anthropic.com/
- **OPENAI_API_KEY** — Get from https://platform.openai.com/api-keys
- **PEXELS_API_KEY** — Optional, from https://www.pexels.com/api/

## Step 4: Customize Your Branding

### Add Your Logo
```bash
# Replace the default logo
cp ~/my_logo.png remotion/public/logos/logo.png
```

### Edit Your Channel Info
Open `config/brand.json` and change:
- `"channel_name"` — Your channel name
- `"lower_third.default_name"` — Your name
- `"lower_third.default_title"` — Your title
- `"colors"` — Your brand colors (optional)

Example:
```json
{
  "channel_name": "Jane Doe",
  "lower_third": {
    "default_name": "Jane Doe",
    "default_title": "Content Creator"
  }
}
```

## Step 5: Verify Setup

```bash
# Check all tools are installed
ffmpeg -version
node -v
python3 -c "import anthropic; import openai; print('✓ All good!')"
```

## Step 6: Process Your First Video

```bash
# Place your video
mkdir -p Youtube_Videos/raw
cp ~/my_recording.mp4 Youtube_Videos/raw/

# Run the pipeline
VIDEO_PATH="Youtube_Videos/raw/my_recording.mp4"
VIDEO_NAME="my_recording"

python tools/transcribe_video.py "$VIDEO_PATH" --output ".tmp/transcript_${VIDEO_NAME}.json"
```

If it works, run the full pipeline (see README.md for the complete command).

## Using with Claude Code

1. Open this repo folder in [Claude Code](https://claude.com/claude-code)
2. Tell Claude: *"Run the content pipeline on my_video.mp4"*
3. Claude orchestrates the entire workflow automatically

## Troubleshooting

**"Python module not found"**
```bash
pip install -r requirements.txt
```

**"Node modules missing"**
```bash
cd remotion && npm install && cd ..
```

**"API key errors"**
- Double-check keys in `.env` have no extra spaces
- Verify keys are valid and haven't expired
- Check account has credits/quota

**"FFmpeg not found"**
```bash
# Mac
brew install ffmpeg

# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

## Next Steps

1. Read [README.md](README.md) for full documentation
2. See [.pi/skills/content-pipeline/SKILL.md](.pi/skills/content-pipeline/SKILL.md) for step-by-step pipeline walkthrough
3. Edit `config/brand.json` with your branding
4. Process your first video

---

**Questions?** Open an issue on GitHub or check the README.
