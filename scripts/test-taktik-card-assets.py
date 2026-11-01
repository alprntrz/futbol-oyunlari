#!/usr/bin/env python3
"""Regression checks for card imports; all writes use an isolated temp project."""
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

CARDS = "gegenpress bus longball wings academy signing legend intl cash crowd".split()


class CardImportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "scripts").mkdir()
        self.script = self.root / "scripts/taktik-card-assets.py"
        shutil.copyfile(Path(__file__).with_name("taktik-card-assets.py"), self.script)
        self.brand = self.root / "mobile/src/lib/brand.ts"
        self.brand.parent.mkdir(parents=True)
        self.brand.write_text('export const OTHER = { aug: "keep" };\nexport const TAKTIK = {\n  hero: "keep",\n};\n')
        self.inputs = self.root / "inputs"
        self.inputs.mkdir()
        self.out = self.root / "mobile/assets/brand/taktik/aug"

    def art(self, card, mode="valid"):
        image = Image.new("RGBA", (512, 512), "red" if mode == "opaque" else (0, 0, 0, 0))
        if mode == "valid":
            ImageDraw.Draw(image).rounded_rectangle((64, 100, 448, 412), radius=40, fill="purple")
        image.save(self.inputs / f"aug-{card}.png")

    def run_import(self, *args, success=True):
        result = subprocess.run([sys.executable, str(self.script), str(self.inputs), *args], capture_output=True, text=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        return result

    def test_full_set_size_alpha_and_repeat(self):
        for card in CARDS:
            self.art(card)
        self.run_import("--require-all")
        first = self.brand.read_bytes()
        files = {p.name: p.read_bytes() for p in self.out.glob("*.png")}
        self.assertEqual(len(files), 10)
        self.assertEqual(first.count(b'require('), 10)
        for path in self.out.glob("*.png"):
            with Image.open(path) as image:
                self.assertEqual(image.size, (360, 360))
                self.assertEqual(image.mode, "RGBA")
                x0, y0, x1, y1 = image.getbbox()
                self.assertTrue(x0 >= 20 and y0 >= 20 and x1 <= 340 and y1 <= 340)
        self.run_import("--require-all")
        self.assertEqual(self.brand.read_bytes(), first)
        self.assertEqual({p.name: p.read_bytes() for p in self.out.glob("*.png")}, files)

    def test_partial_keeps_previous_and_other_registry(self):
        self.art("bus")
        self.run_import()
        previous = (self.out / "aug-bus.png").read_bytes()
        (self.inputs / "aug-bus.png").unlink()
        self.art("cash")
        self.run_import()
        text = self.brand.read_text()
        self.assertIn('bus: require(', text)
        self.assertIn('cash: require(', text)
        self.assertIn('OTHER = { aug: "keep" }', text)
        self.assertIn('hero: "keep"', text)
        self.assertEqual((self.out / "aug-bus.png").read_bytes(), previous)

    def test_invalid_batch_does_not_write(self):
        for mode in ("empty", "opaque"):
            with self.subTest(mode=mode):
                self.art("bus")
                self.art("cash", mode)
                before = self.brand.read_bytes()
                self.run_import(success=False)
                self.assertEqual(self.brand.read_bytes(), before)
                self.assertFalse(self.out.exists())

    def test_missing_and_unrecognised_inputs_do_not_write(self):
        self.run_import(success=False)
        self.art("bus")
        self.run_import("--require-all", success=False)
        self.assertFalse(self.out.exists())

    def test_corrupt_image_and_bad_registry_do_not_write(self):
        (self.inputs / "aug-bus.png").write_bytes(b"not a PNG")
        self.run_import(success=False)
        self.art("bus")
        self.brand.write_text("export const SOMETHING_ELSE = {};\n")
        self.run_import(success=False)
        self.assertFalse(self.out.exists())


if __name__ == "__main__":
    unittest.main()
