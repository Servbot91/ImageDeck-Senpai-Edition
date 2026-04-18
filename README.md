||||
|-|-|-|
:placard: | **Summary** | An optimized single-hand gallery and image viewer for Stash that replaces the default image viewer.
:link: | **Repository** | <https://github.com/Servbot91/Deck-Viewer/tree/main/plugins/Deck%20Viewer>
:information_source: | **Source URL** | https://raw.githubusercontent.com/Servbot91/Deck-Viewer/refs/heads/main/plugins/manifest.yml
:open_book: | **Install** | [How to install a plugin?](https://discourse.stashapp.cc/t/-/1015)


## Overview

Deck Viewer is the Sakoto fork and complete re imagination of the original [Image-Deck plugin](https://discourse.stashapp.cc/t/image-deck-fullscreen-swipeable-image-viewer/). It hijacks the built in stash image viewer. It is meant to further enhance gallery and image content consumption, streamlining one handed use while providing necessary functionality for cataloging and reducing accidental clicks\swipes when you're just trying to pad your O stats.

Deck Viewer was written with AI assistance (qwen3-coder:480b, and my local qwen3-coder30b) following general Dev standards and hygiene while also protecting integrity of the plugin with simple A\B testing and versioning.

---
## Screenshots
<details>
  <summary>Click to expand</summary>

![Screenshot 2026-03-26 164733|690x210](upload://82i5AqX5ZrhC0NdSJg6dtpE9fM3.png)![Screenshot 2026-03-26 164724|690x35](upload://jKuSTdtCBV8Vwf6qgmyTR8vDDlj.png)![Screenshot 2026-03-26 164707|259x499](upload://nStsruouZqcdeMTtAk4u8xqDwYM.png)![Screenshot 2026-03-26 164655|279x500](upload://efU2IMdJLDjW3eBxoOSzuwh9gTA.png)![Screenshot 2026-03-25 120836|325x499](upload://liBPfEnyeqODQ5D6Oh8llPc7Qb1.png)![Screenshot 2026-03-25 120829|326x500](upload://df2Xt6dzKFhzHU0v9h4csbZpdLR.jpeg)![Screenshot_20260417_201436_Firefox|277x500](upload://ecm6P4JMlb6xwEHsUo3x9DDlYDI.jpeg)![Screenshot_20260417_153930_Firefox|277x500](upload://yQbZ1tJaFtHNNRhsH45m4yY3NxT.jpeg)![Screenshot_20260417_154125_Firefox|277x500](upload://j8xRZsk4uE9qnqU68Y2rn4yYMNT.jpeg)![Screenshot_20260417_173904_Firefox|278x500](upload://hLWx0FZILoeyUstDRVR7sGUglzj.jpeg)![Screenshot_20260417_185845_Firefox|277x500](upload://4dvgiBxWKZEmVIJOPMYTZffgJ0D.jpeg)![Screenshot 2026-04-16 204534|690x496](upload://bmF62icqy1egDUjMKvnqxunw7Ri.jpeg)![Screenshot 2026-04-16 204458|630x500](upload://jr2cVCUQ8jSSmPDnSt19jZj5VaE.jpeg)



</details>

---
## Improvements

### Feature Integration
- Performer page integration. Switch Between Gallery Mode and Image Mode anytime regardless of where you are in stash even on performer pages!
- Added Mouse wheel functionality
- Tag images\galleries with studios, update titles, details, performer gallery tags
- Added zoom functionality for mobile and desktop (buttons respect context ie no zoom on galleries)
- Full mobile integration and optimization
- One Handed browsing
- Added Gallery support
- Added keyboard support (strict)
- Supports SFW Plugin
- Integrated with default stash buttons
- Filter your galleries\images in real time. Add exclusions, or filter for performers. It all happens server side with minimal client side stress.
- Default Stash Image Viewer Hijacking
- Localstorage utilized to remember states and places, persists.
- Infinite Scroll 
	- For as long as you have content. It will scroll as long as content exists, it however does not loop around.
---
### Performance

- Optimized for large datasets (in the millions)
- Added 'Chunk' system
	- Images are locked to 50 on load for performance. Once you are nearing the end of a chunk, the next chunk is loaded. You also have the option to preload multiple chunks ahead by pressing the load next chunk feature.
	- Chunk system has a safety check to prevent backend query spam and will skip if a chunk load is in progress
	- Can manually load the next chunk via button
- Removed bloat effects
- Backend GraphQL is properly using stash schema
---

### QOL Improvements

- Server Side Filtering
- Focused view over original card view
- Buttons and text fade out when zoomed in
- Single hand optimizations

## Release notes
- 04-17-2026 -  Going forward all release notes will be posted on the github releases -> [Full Version 1.2 release notes](https://github.com/Servbot91/Deck-Viewer/releases/tag/1.2)

- 3-26-2026 - [Full version 1.0 release notes](https://github.com/Servbot91/Deck-Viewer/blob/main/Previous-Releases/ReleaseNotes.md)
---
## Installation
1. Settings → Plugins → Available Plugins
2. Add Source → Name: Deck Viewer
3. Source URL: https://github.com/Servbot91/Deck-Viewer/raw/refs/heads/main/plugins/manifest.yml
4. Click checkbox, Install
5. Reload Plugins
