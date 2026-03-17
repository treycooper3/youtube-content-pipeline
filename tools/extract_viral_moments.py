"""
Viral Moments Extractor

Analyzes video transcripts using GPT-4 to identify viral-worthy moments for YouTube Shorts.
Returns timestamps, suggested titles, and clip recommendations ranked by virality potential.

Usage:
    python extract_viral_moments.py --transcript path/to/transcript.txt
    python extract_viral_moments.py --video-id dQw4w9WgXcQ

Requirements:
    - OPENAI_API_KEY in .env file
    - openai>=1.0.0
    - tiktoken>=0.5.0 (for cost estimation)

Output:
    - .tmp/viral_moments_YYYY-MM-DD.json

Author: WAT Framework
Last Updated: 2026-01-29
"""

import os
import sys
import json
import argparse
import re
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# Configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
VIRAL_MOMENTS_MODEL = os.getenv('VIRAL_MOMENTS_MODEL', 'gpt-4o')
VIRAL_MOMENTS_THRESHOLD = float(os.getenv('VIRAL_MOMENTS_THRESHOLD', '0.65'))
VIRAL_MOMENTS_MAX_DURATION = int(os.getenv('VIRAL_MOMENTS_MAX_DURATION', '90'))
VIRAL_MOMENTS_MIN_DURATION = int(os.getenv('VIRAL_MOMENTS_MIN_DURATION', '15'))

# Circuit breakers
CIRCUIT_BREAKER = {
    "max_retries": 3,
    "timeout_seconds": 120,
    "max_transcript_chars": 100000,  # ~25K tokens
    "alert_on_failure": True,
}

# GPT-4 System Prompt for Viral Moment Detection
SYSTEM_PROMPT = """You are an expert content strategist specializing in identifying viral-worthy moments from video transcripts for YouTube Shorts (15-90 seconds).

Your task is to analyze transcripts and identify moments that have the HOOK → PEAK → PAYOFF structure:

1. HOOK (0-3 seconds): Grabs immediate attention with a question, bold statement, or intrigue
2. PEAK (middle): Delivers emotional impact - surprise, insight, humor, or validation
3. PAYOFF (end): Resolves with actionable insight or memorable takeaway

For YouTube Shorts success, prioritize moments with:
- Counterintuitive insights that challenge audience assumptions
- "Aha!" moments where complex ideas become crystal clear
- Emotional peaks (wow, laugh, surprise, inspiration)
- Controversial/debatable points (sparks engagement in comments)
- Actionable tips viewers can implement immediately
- Vulnerable/authentic moments (human connection)
- Surprising numbers and statistics
- Common mistakes and how to fix them

IMPORTANT RULES:
1. Only identify moments that are SELF-CONTAINED - they must make sense without additional context
2. The moment must have a clear beginning and end
3. Avoid mid-sentence cuts - find natural pause points
4. Prioritize moments where the speaker's energy/passion is highest
5. The first 3 seconds must be immediately engaging (no slow intros)

Return your analysis as a JSON array of moments, each with the required fields."""

USER_PROMPT_TEMPLATE = """Analyze this YouTube video transcript and extract the top 5-8 viral-worthy moments for YouTube Shorts (15-90 seconds each).

VIDEO DURATION: {video_duration} seconds
TRANSCRIPT:
{transcript}

---

For each viral moment, return a JSON object with these EXACT fields:

{{
  "moments": [
    {{
      "rank": 1,
      "start_time": "03:45",
      "end_time": "04:12",
      "duration_seconds": 27,
      "moment_type": "HOOK",
      "virality_score": 0.92,
      "hook_strength": 0.95,
      "suggested_title": "5-8 word YouTube Shorts title",
      "suggested_clip_text": "Key verbatim quote from this moment",
      "engagement_prediction": "shock | laugh | learn | validate | inspire",
      "thumbnail_concept": "1-2 word thumbnail idea",
      "reasoning": "1-2 sentences explaining why this moment will perform well"
    }}
  ]
}}

MOMENT TYPES: HOOK, INSIGHT, EMOTIONAL_PEAK, CONTROVERSIAL, ACTIONABLE_TIP, AUTHENTIC, STORY

RULES:
- Timestamps must exist in the transcript (verify before including)
- Only include moments with virality_score >= {threshold}
- Sort by virality_score descending (highest first)
- Be precise with start/end times - no mid-sentence cuts
- suggested_clip_text must be an EXACT quote from the transcript

Return ONLY valid JSON, no additional text or markdown."""


class ViralMomentsExtractor:
    """Extract viral-worthy moments from video transcripts using GPT-4."""

    def __init__(self, api_key: str, model: str = VIRAL_MOMENTS_MODEL):
        """
        Initialize the extractor with OpenAI credentials.

        Args:
            api_key: OpenAI API key
            model: Model to use (default: gpt-4o)
        """
        if not api_key:
            raise ValueError("OpenAI API key is required. Set OPENAI_API_KEY in .env file.")

        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.extracted_moments = []
        self.last_cost_estimate = 0.0

    def estimate_cost(self, transcript: str) -> tuple[float, int]:
        """
        Estimate API cost before processing.

        Args:
            transcript: The transcript text

        Returns:
            Tuple of (estimated_cost, token_count)
        """
        try:
            import tiktoken
            encoding = tiktoken.encoding_for_model(self.model)
            input_tokens = len(encoding.encode(transcript + SYSTEM_PROMPT + USER_PROMPT_TEMPLATE))
        except ImportError:
            # Fallback: estimate ~4 chars per token
            input_tokens = len(transcript + SYSTEM_PROMPT + USER_PROMPT_TEMPLATE) // 4

        # GPT-4o pricing (as of Jan 2026)
        input_cost_per_1k = 0.005
        output_tokens_est = 2000  # Assume ~2000 output tokens
        output_cost_per_1k = 0.015

        total_cost = (input_tokens / 1000 * input_cost_per_1k) + \
                     (output_tokens_est / 1000 * output_cost_per_1k)

        self.last_cost_estimate = round(total_cost, 4)
        return self.last_cost_estimate, input_tokens

    def extract_moments(
        self,
        transcript: str,
        video_id: Optional[str] = None,
        video_duration: Optional[int] = None,
        threshold: float = VIRAL_MOMENTS_THRESHOLD
    ) -> list[dict]:
        """
        Extract viral moments from a transcript using GPT-4.

        Args:
            transcript: Video transcript text with timestamps
            video_id: Optional YouTube video ID
            video_duration: Video duration in seconds (helps GPT understand context)
            threshold: Minimum virality score to include (0-1)

        Returns:
            List of viral moment dictionaries
        """
        # Validate transcript length
        if len(transcript) > CIRCUIT_BREAKER["max_transcript_chars"]:
            print(f"Warning: Transcript exceeds {CIRCUIT_BREAKER['max_transcript_chars']} chars. Truncating...")
            transcript = transcript[:CIRCUIT_BREAKER["max_transcript_chars"]]

        # Estimate cost
        cost, tokens = self.estimate_cost(transcript)
        print(f"Estimated API cost: ${cost:.4f} ({tokens:,} input tokens)")

        # Build the prompt
        user_prompt = USER_PROMPT_TEMPLATE.format(
            video_duration=video_duration or "unknown",
            transcript=transcript,
            threshold=threshold
        )

        # Call GPT-4
        print(f"Analyzing transcript with {self.model}...")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )

            # Parse the response
            response_text = response.choices[0].message.content
            result = json.loads(response_text)

            # Extract moments from response
            moments = result.get("moments", [])

            # Validate and filter moments
            validated_moments = self._validate_moments(moments, transcript, threshold)

            # Sort by virality score
            validated_moments.sort(key=lambda x: x.get("virality_score", 0), reverse=True)

            self.extracted_moments = validated_moments
            print(f"Extracted {len(validated_moments)} viral moments (threshold: {threshold})")

            return validated_moments

        except json.JSONDecodeError as e:
            print(f"Error parsing GPT response as JSON: {e}")
            return []
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            return []

    def _validate_moments(
        self,
        moments: list[dict],
        transcript: str,
        threshold: float
    ) -> list[dict]:
        """
        Validate extracted moments against the transcript.

        Args:
            moments: List of moment dictionaries from GPT
            transcript: Original transcript for validation
            threshold: Minimum virality score

        Returns:
            List of validated moments
        """
        validated = []
        transcript_lower = transcript.lower()

        for i, moment in enumerate(moments):
            # Check virality score threshold
            score = moment.get("virality_score", 0)
            if score < threshold:
                print(f"  Skipping moment {i+1}: score {score} < threshold {threshold}")
                continue

            # Check duration constraints
            duration = moment.get("duration_seconds", 0)
            if duration < VIRAL_MOMENTS_MIN_DURATION:
                print(f"  Skipping moment {i+1}: duration {duration}s < min {VIRAL_MOMENTS_MIN_DURATION}s")
                continue
            if duration > VIRAL_MOMENTS_MAX_DURATION:
                print(f"  Adjusting moment {i+1}: duration {duration}s > max {VIRAL_MOMENTS_MAX_DURATION}s")
                moment["duration_seconds"] = VIRAL_MOMENTS_MAX_DURATION

            # Validate clip text exists in transcript (fuzzy match)
            clip_text = moment.get("suggested_clip_text", "")
            if clip_text:
                # Check if key words from the clip exist in transcript
                key_words = [w for w in clip_text.lower().split() if len(w) > 4][:5]
                matches = sum(1 for w in key_words if w in transcript_lower)
                if matches < len(key_words) * 0.5:
                    print(f"  Warning: Clip text for moment {i+1} may not match transcript exactly")
                    moment["validation_warning"] = "clip_text_fuzzy_match"

            # Add moment ID
            moment["moment_id"] = f"moment_{i+1:03d}"

            validated.append(moment)

        return validated

    def _parse_timestamp(self, timestamp: str) -> int:
        """
        Parse MM:SS or HH:MM:SS timestamp to seconds.

        Args:
            timestamp: Timestamp string

        Returns:
            Time in seconds
        """
        parts = timestamp.split(":")
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        return 0

    def save_to_file(
        self,
        moments: list[dict],
        video_id: Optional[str] = None,
        filename: Optional[str] = None
    ) -> str:
        """
        Save extracted moments to JSON file.

        Args:
            moments: List of moment dictionaries
            video_id: Optional video ID for filename
            filename: Output filename (default: .tmp/viral_moments_YYYY-MM-DD.json)

        Returns:
            Path to saved file
        """
        if filename is None:
            date_str = datetime.now().strftime('%Y-%m-%d')
            video_suffix = f"_{video_id}" if video_id else ""
            filename = f".tmp/viral_moments{video_suffix}_{date_str}.json"

        # Ensure .tmp directory exists
        os.makedirs('.tmp', exist_ok=True)

        # Calculate statistics
        if moments:
            avg_score = sum(m.get("virality_score", 0) for m in moments) / len(moments)
            avg_duration = sum(m.get("duration_seconds", 0) for m in moments) / len(moments)
            moment_types = {}
            for m in moments:
                mt = m.get("moment_type", "UNKNOWN")
                moment_types[mt] = moment_types.get(mt, 0) + 1
        else:
            avg_score = 0
            avg_duration = 0
            moment_types = {}

        # Build output with metadata
        output = {
            "metadata": {
                "extraction_date": datetime.now().isoformat(),
                "video_id": video_id,
                "model_used": self.model,
                "threshold": VIRAL_MOMENTS_THRESHOLD,
                "total_moments_extracted": len(moments),
                "api_cost_estimate": self.last_cost_estimate,
            },
            "statistics": {
                "avg_virality_score": round(avg_score, 3),
                "avg_duration_seconds": round(avg_duration, 1),
                "moment_type_distribution": moment_types,
            },
            "moments": moments
        }

        # Save to file
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        print(f"Saved to: {filename}")
        return filename


def load_transcript(source: str) -> tuple[str, Optional[str]]:
    """
    Load transcript from file or fetch from YouTube.

    Args:
        source: File path or YouTube video ID

    Returns:
        Tuple of (transcript_text, video_id)
    """
    # Check if it's a file path
    if os.path.exists(source):
        print(f"Loading transcript from file: {source}")
        with open(source, 'r', encoding='utf-8') as f:
            transcript = f.read()
        return transcript, None

    # Check if it's a YouTube URL or video ID
    video_id = None
    if "youtube.com" in source or "youtu.be" in source:
        # Extract video ID from URL
        match = re.search(r'(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})', source)
        if match:
            video_id = match.group(1)
    elif len(source) == 11 and re.match(r'^[a-zA-Z0-9_-]+$', source):
        video_id = source

    if video_id:
        # Try to fetch transcript from YouTube
        print(f"Fetching transcript for video: {video_id}")
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)

            # Format transcript with timestamps
            formatted = []
            for entry in transcript_list:
                timestamp = f"[{int(entry['start'] // 60):02d}:{int(entry['start'] % 60):02d}]"
                formatted.append(f"{timestamp} {entry['text']}")

            transcript = "\n".join(formatted)
            return transcript, video_id
        except ImportError:
            print("Error: youtube_transcript_api not installed. Install with: pip install youtube-transcript-api")
            sys.exit(1)
        except Exception as e:
            print(f"Error fetching transcript: {e}")
            sys.exit(1)

    print(f"Error: Could not load transcript from: {source}")
    sys.exit(1)


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description="Extract viral moments from video transcripts using GPT-4"
    )
    parser.add_argument(
        "source",
        help="Transcript file path, YouTube URL, or video ID"
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=VIRAL_MOMENTS_THRESHOLD,
        help=f"Minimum virality score (0-1, default: {VIRAL_MOMENTS_THRESHOLD})"
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=None,
        help="Video duration in seconds (optional, improves analysis)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Estimate cost without calling API"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file path (default: .tmp/viral_moments_YYYY-MM-DD.json)"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Viral Moments Extractor - WAT Framework")
    print("=" * 60)
    print()

    # Load transcript
    transcript, video_id = load_transcript(args.source)
    print(f"Transcript loaded: {len(transcript):,} characters")

    # Initialize extractor
    extractor = ViralMomentsExtractor(OPENAI_API_KEY)

    # Estimate cost
    cost, tokens = extractor.estimate_cost(transcript)
    print(f"Estimated cost: ${cost:.4f} ({tokens:,} tokens)")

    if args.dry_run:
        print("\n--dry-run: Skipping API call")
        return

    # Extract moments
    print()
    moments = extractor.extract_moments(
        transcript=transcript,
        video_id=video_id,
        video_duration=args.duration,
        threshold=args.threshold
    )

    if moments:
        # Save results
        output_file = extractor.save_to_file(
            moments=moments,
            video_id=video_id,
            filename=args.output
        )

        # Print summary
        print("\n" + "=" * 60)
        print("Extraction Summary:")
        print("=" * 60)
        print(f"Moments extracted: {len(moments)}")
        print(f"Avg virality score: {sum(m['virality_score'] for m in moments) / len(moments):.2f}")
        print(f"Total clip time: {sum(m['duration_seconds'] for m in moments)} seconds")
        print()

        for i, m in enumerate(moments[:5], 1):  # Show top 5
            print(f"{i}. [{m['start_time']} - {m['end_time']}] {m['suggested_title']}")
            print(f"   Score: {m['virality_score']:.2f} | Type: {m['moment_type']}")

        if len(moments) > 5:
            print(f"   ... and {len(moments) - 5} more")

        print(f"\nOutput file: {output_file}")
        print("=" * 60)
    else:
        print("\nNo viral moments found above threshold. Try lowering --threshold value.")


if __name__ == "__main__":
    main()
