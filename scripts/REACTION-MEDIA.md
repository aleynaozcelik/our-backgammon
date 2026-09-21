Reaction files live in `public/assets/images/badMoves` and `public/assets/images/niceMoves`.
`npm run dev` and `npm run build` refresh `lib/game/reaction-media.json` automatically.
When adding files with the dev server already running, run `npm run media:generate`.
Names and extension casing are preserved; `bad-move.*` is the first Hector capture reaction.

JPG, JPEG, PNG, GIF, WebP, AVIF, SVG, BMP and APNG render as images.
MP4, WebM and OGV render as videos (use browser-compatible codecs).
MOV, M4V, AVI and MKV are converted to H.264/AAC MP4 using FFmpeg on PATH.
Install FFmpeg on the build machine when using these formats, or convert them before adding them.
Generated conversions are placed in `public/assets/reaction-videos` and reused while newer than their source.
