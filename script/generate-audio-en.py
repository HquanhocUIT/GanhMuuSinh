"""Generate one English MP3 per translated food script with KorvaTTS."""

from pathlib import Path
import re

import soundfile as sf
from korvatts import TTS


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = Path(__file__).resolve().parent / "en"
OUTPUT_DIR = ROOT / "fe" / "public" / "audio" / "stories"
VOICE = "ngoc_huyen"
SPEED = 0.96
STEPS = 32
SAMPLE_RATE = 44_100
SECTION = re.compile(r"(?ms)^## Kịch bản lời dẫn\s*\n(.*?)(?=^## |\Z)")


def read_narration(path: Path) -> str:
    match = SECTION.search(path.read_text(encoding="utf-8"))
    if not match:
        raise ValueError(f"Kịch bản lời dẫn is missing in {path.name}")
    narration = " ".join(line.strip() for line in match.group(1).splitlines() if line.strip())
    if not narration:
        raise ValueError(f"Narration is empty in {path.name}")
    return narration


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(SCRIPTS_DIR.glob("*.md"))
    if not sources:
        raise SystemExit("No English food scripts found.")

    tts = TTS()
    for source in sources:
        wav, duration = tts.synthesize(
            read_narration(source),
            voice=VOICE,
            lang="en",
            total_steps=STEPS,
            speed=SPEED,
        )
        output = OUTPUT_DIR / f"{source.stem}-en.mp3"
        sf.write(output, wav, SAMPLE_RATE, format="MP3")
        print(f"{output.name}: {duration:.1f}s · {output.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
