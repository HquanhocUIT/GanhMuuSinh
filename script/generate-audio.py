"""Generate one Vietnamese MP3 per food script with local KorvaTTS."""

from pathlib import Path
import re

import soundfile as sf
from korvatts import TTS


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "script"
OUTPUT_DIR = ROOT / "fe" / "public" / "audio" / "stories"
VOICE = "ngoc_huyen"
SPEED = 0.96
STEPS = 32
SAMPLE_RATE = 44_100
SECTION = re.compile(r"(?ms)^## Kịch bản lời dẫn\s*\n(.*?)(?=^## |\Z)")


def read_narration(path: Path) -> str:
    match = SECTION.search(path.read_text(encoding="utf-8"))
    if not match:
        raise ValueError(f"Không tìm thấy mục Kịch bản lời dẫn trong {path.name}")
    lines = [line.strip() for line in match.group(1).splitlines() if line.strip()]
    narration = " ".join(lines)
    if not narration:
        raise ValueError(f"Kịch bản lời dẫn đang trống: {path.name}")
    return narration


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = sorted(path for path in SCRIPTS_DIR.glob("*.md") if path.name != "00-huong-dan-notebooklm.md")
    if not sources:
        raise SystemExit("Không tìm thấy kịch bản món ăn.")

    tts = TTS()
    for source in sources:
        narration = read_narration(source)
        wav, duration = tts.synthesize(
            narration,
            voice=VOICE,
            lang="vi",
            total_steps=STEPS,
            speed=SPEED,
        )
        output = OUTPUT_DIR / f"{source.stem}.mp3"
        sf.write(output, wav, SAMPLE_RATE, format="MP3")
        print(f"{source.stem}: {duration:.1f}s · {output.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
