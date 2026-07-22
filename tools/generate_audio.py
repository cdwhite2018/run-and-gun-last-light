"""Generate compact, original placeholder music and sampled SFX for the game."""
from pathlib import Path
import math, random, struct, wave

ROOT = Path(__file__).parents[1] / "public" / "audio"
RATE = 22050

def write(name, samples):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = max(1.0, max(abs(x) for x in samples))
    with wave.open(str(path), "wb") as out:
        out.setparams((1, 2, RATE, len(samples), "NONE", "not compressed"))
        out.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x / peak)) * 27500)) for x in samples))

def tone(freq, t, shape="sine"):
    phase = 2 * math.pi * freq * t
    return math.sin(phase) if shape == "sine" else (2 / math.pi) * math.asin(math.sin(phase))

def soundtrack(name, root, bpm, mood):
    random.seed(root)
    seconds = 12
    notes = mood
    beat = 60 / bpm
    data = []
    for i in range(seconds * RATE):
        t = i / RATE
        step = int(t / (beat / 2)) % len(notes)
        freq = root * (2 ** (notes[step] / 12))
        env = .45 + .55 * math.exp(-((t % (beat / 2)) / (beat / 2)) * 4)
        bass = tone(root / 2 * (2 ** (notes[(step // 2) % len(notes)] / 12)), t, "tri") * .23
        lead = tone(freq, t, "tri") * .20 * env
        pad = (tone(root * 1.5, t) + tone(root * 2, t)) * .045
        kick_phase = t % beat
        kick = math.sin(2 * math.pi * (72 - 45 * kick_phase / beat) * t) * math.exp(-kick_phase * 18) * .22
        data.append((bass + lead + pad + kick) * .72)
    write(f"music/{name}.wav", data)

def effect(name, seconds, fn):
    random.seed(name)
    write(f"sfx/{name}.wav", [fn(i / RATE, i / (seconds * RATE)) for i in range(int(seconds * RATE))])

soundtrack("beach", 196, 104, [0, 4, 7, 9, 7, 4, 2, 7])
soundtrack("mountain", 174, 88, [0, 3, 7, 10, 7, 5, 3, -2])
soundtrack("bunker", 110, 118, [0, 0, 3, 1, 0, 6, 3, 1])
soundtrack("volcano", 82, 132, [0, 1, 6, 5, 0, 8, 6, 1])
effect("fire", .11, lambda t, p: (random.random()*2-1)*math.exp(-p*8)*.65 + tone(160-95*p,t,"tri")*math.exp(-p*12))
effect("jump", .22, lambda t, p: tone(220+520*p,t,"tri")*math.sin(math.pi*p)*.7)
effect("impact", .16, lambda t, p: (random.random()*2-1)*math.exp(-p*7)*.8)
effect("damage", .30, lambda t, p: tone(145-90*p,t,"tri")*math.exp(-p*4)*.8)
effect("enemy_down", .34, lambda t, p: (tone(240-170*p,t,"tri")*.7+(random.random()*2-1)*.2)*math.exp(-p*4))
effect("cheer", 1.4, lambda t, p: ((random.random()*2-1)*.45 + tone(440+220*math.sin(t*5),t)*.12)*math.sin(math.pi*p))
