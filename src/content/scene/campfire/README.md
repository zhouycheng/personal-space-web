# Campfire flame atlas

`flame-atlas.png` combines Unity Labs' Flame03 and Flame03-hollow image sequences, released under [CC0](https://creativecommons.org/publicdomain/zero/1.0/).

Source: [Free VFX image sequences and flipbooks](https://unity.com/blog/engine-platform/free-vfx-image-sequences-flipbooks), Unity Technologies, 2016-11-28.

- Flame03: https://unity3d.com/files/labs/downloads/vfx/assets01/Flame03/Flame03-flipbooks.zip
- Flame03-hollow: https://unity3d.com/files/labs/downloads/vfx/assets01/Flame03-hollow/Flame03-hollow-flipbooks.zip
- The TGA sheets are decoded with Three.js TGALoader, converted to straight-alpha RGBA, and packed into one 1024 × 1024 PNG using Sharp. Alpha is `max(R,G,B)^0.8`; RGB is divided by alpha to preserve emission during normal blending.
- The 16 × 8 grid contains 64 frames of Flame03 followed by 64 evenly sampled frames of Flame03-hollow. Each frame is 64 × 128 pixels. Tile playback uses the source's top-to-bottom row order. Despite its `16x4` filename, the hollow TGA contains a 16 × 5 grid; extract its 80 frames before resampling, rather than resizing the whole sheet into a 16 × 4 grid.
- Runtime rendering uses MIT-licensed three.quarks 0.17.1. The committed lockfile pins its quarks.core dependency.

## Wood surface maps

`bark-color.jpg` and `bark-height.jpg` use the diffuse and bump maps from [Bark Brown 02](https://polyhaven.com/a/bark_brown_02) by Rob Tuytel, supplied by Poly Haven under [CC0](https://polyhaven.com/license). The 1K JPG originals were verified against the official API's MD5 values and resized to 512 × 512 at JPEG quality 88 with Sharp. The rack and seven fire logs share these two local maps; a brown material remains available if loading fails.
