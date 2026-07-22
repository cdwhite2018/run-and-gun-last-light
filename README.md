# Run & Gun: Last Light

A browser side-scrolling shooter with four selectable heroes.

## Play online

https://cdwhite2018.github.io/run-and-gun-last-light/

## Controls

- `A` / `D` or arrows: move
- `W` / `S` or up/down arrows: move through the depth lane
- Space: jump and double jump
- `F`, `J`, or left Ctrl: fire
- Shift: sprint

## Custom music

The four looping tracks are in `public/audio/music`. You can replace them with your own browser-compatible files and update the matching paths in `app/Game.tsx`. Keep each track normalized to a similar loudness and trimmed for a clean loop. Music and sound effects have independent volume controls in the game header.

## Local Windows build

Install Node.js 22 or newer, open PowerShell here, and run:

```powershell
npm install
npm run dev
```

For a production build, run `npm run build`.

## GitHub Pages deployment

Every push to `main` builds the static game and publishes it to GitHub Pages automatically.
