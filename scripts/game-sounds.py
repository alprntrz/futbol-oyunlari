#!/usr/bin/env python3
"""
Synthesises the game's sound effects (casual-game style: bright, short, bouncy)
into mobile/assets/sounds/*.wav. No samples, so no licensing. Standard library only.

Usage: python3 scripts/game-sounds.py
"""
import math
import random
import struct
import wave
from pathlib import Path

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "mobile" / "assets" / "sounds"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(7)


def note(n: str) -> float:
    """'C5' → Hz."""
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12)


def silence(sec):
    return [0.0] * int(SR * sec)


def tone(freq, sec, vol=0.5, attack=0.004, decay=None, partials=((1, 1.0),), glide=0.0, vibrato=0.0):
    """Additive tone with a fast attack and an exponential tail (bell/pluck feel)."""
    n = int(SR * sec)
    decay = decay or sec / 4
    out = []
    phase = [0.0] * len(partials)
    for i in range(n):
        t = i / SR
        f = freq * (1 + glide * t / sec) * (1 + vibrato * math.sin(2 * math.pi * 6 * t))
        env = min(1.0, t / attack) * math.exp(-t / decay)
        s = 0.0
        for k, (mul, amp) in enumerate(partials):
            phase[k] += 2 * math.pi * f * mul / SR
            s += amp * math.sin(phase[k])
        out.append(s * env * vol)
    return out


def noise(sec, vol=0.3, lo=0.0, hi=1.0, attack=0.01, decay=None):
    """Noise through a one-pole low-pass whose cutoff sweeps lo→hi (0..1): a whoosh."""
    n = int(SR * sec)
    decay = decay or sec / 3
    out, y = [], 0.0
    for i in range(n):
        t = i / SR
        a = lo + (hi - lo) * (i / n)
        y += a * (random.uniform(-1, 1) - y)
        env = min(1.0, t / attack) * math.exp(-t / decay)
        out.append(y * env * vol)
    return out


def mix(*tracks):
    """Overlay (start_sec, samples) pairs."""
    length = max(int(s * SR) + len(x) for s, x in tracks)
    out = [0.0] * length
    for s, x in tracks:
        o = int(s * SR)
        for i, v in enumerate(x):
            out[o + i] += v
    return out


BELL = ((1, 1.0), (2, 0.35), (3, 0.15), (4.2, 0.08))
MARIMBA = ((1, 1.0), (4, 0.25), (10, 0.05))
BRASS = ((1, 1.0), (2, 0.6), (3, 0.4), (4, 0.25), (5, 0.12))


def save(name, samples, gain=0.9):
    peak = max(1e-9, max(abs(v) for v in samples))
    k = gain / peak
    # soft fade-out to avoid clicks
    fade = int(SR * 0.01)
    for i in range(fade):
        samples[-1 - i] *= i / fade
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * k)) * 32767)) for v in samples))
    print(name, f"{len(samples) / SR:.2f}s")


# a reward card lands: bubbly pop going up
save("pop", tone(660, 0.12, partials=((1, 1.0), (2, 0.3)), decay=0.04, glide=0.9), 0.7)

# coin / point tick
save("coin", mix((0, tone(note("B5"), 0.09, partials=BELL, decay=0.05)), (0.06, tone(note("E6"), 0.35, partials=BELL, decay=0.12))), 0.7)

# right answer: two bright chimes
save("correct", mix((0, tone(note("C6"), 0.25, partials=BELL, decay=0.08)), (0.09, tone(note("G6"), 0.5, partials=BELL, decay=0.18))), 0.8)

# wrong answer: soft low double bonk
save("wrong", mix((0, tone(note("D#3"), 0.18, partials=MARIMBA, decay=0.06, glide=-0.15)), (0.13, tone(note("C3"), 0.3, partials=MARIMBA, decay=0.1, glide=-0.2))), 0.75)

# panel / cards sliding in
save("whoosh", noise(0.32, 0.6, 0.02, 0.35, attack=0.12, decay=0.12), 0.45)

# title stamp: low thump plus a little click
save("stamp", mix((0, tone(110, 0.25, decay=0.06, glide=-0.5)), (0, noise(0.05, 0.3, 0.6, 0.3))), 0.85)

# victory fanfare: brassy arpeggio, held chord, sparkle on top
arp = [("C5", 0.0), ("E5", 0.11), ("G5", 0.22)]
chord = ["C5", "E5", "G5", "C6"]
tracks = [(t, tone(note(n), 0.22, vol=0.5, partials=BRASS, decay=0.12)) for n, t in arp]
tracks += [(0.36, tone(note(n), 1.1, vol=0.35, partials=BRASS, attack=0.02, decay=0.5, vibrato=0.004)) for n in chord]
tracks += [(0.42 + i * 0.07, tone(note(n), 0.4, vol=0.18, partials=BELL, decay=0.12)) for i, n in enumerate(["G6", "C7", "E7", "G7", "C8"])]
save("victory", mix(*tracks), 0.9)

# series over / lost: gentle descending three notes
save("lose", mix(*[(t, tone(note(n), 0.5, vol=0.5, partials=MARIMBA, decay=0.2)) for n, t in [("G4", 0), ("E4", 0.18), ("C4", 0.36)]]), 0.7)

# level up: rising run and a shimmer
run = ["C5", "D5", "E5", "G5", "A5", "C6", "E6"]
tracks = [(i * 0.06, tone(note(n), 0.3, vol=0.45, partials=BELL, decay=0.1)) for i, n in enumerate(run)]
tracks += [(0.45, tone(note("C7"), 0.9, vol=0.25, partials=BELL, decay=0.35, vibrato=0.006))]
save("levelup", mix(*tracks), 0.85)

# get ready / match start whistle-ish blip
save("start", mix((0, tone(note("A5"), 0.12, partials=BELL, decay=0.05)), (0.14, tone(note("A6"), 0.35, partials=BELL, decay=0.12))), 0.7)
