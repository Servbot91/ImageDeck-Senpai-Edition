# Release Notes: Version 1.0

## What is it?

Deck Viewer is a complete rework and reimagination of the original Image-Deck plugin. I have commandeered its base code and have brought it up to a stable and functional standard with enhanced features and optimization. It can be used solely over the built in viewbox or along side it. The plugin design is to make browsing galleries and images more streamlined and less error prone to accident clicks\swipes and to futher optimize one hand browsing. There may be some references to image-deck in my code only because I couldn't be bothered.
---
## Improvements

### Feature Integration and MISC
- Performer page integration
	- logic works properly for gallery or images selection
- Added Mouse wheel functionality
- Added zoom functionality for mobile and desktop (buttons respect context ie no zoom on galleries)
- Swipe and pinch gestures on mobile functional
- Added Gallery support
- Galleries display performer name and image count and clicking\selecting them will open the respective gallery
- Added keyboard support (strict)
- Supports SFW Plugin
- Infinite Scroll 
	- For as long as you have content. It will scroll as long as content exists, it however does not loop around as this caused way too many issues for me to give a damn to fully implement it
---
### Performance

- Optimized for large datasets (in the millions)
- Added 'Chunk' system
	- Images are locked to 50 on load for performance. Once you are nearing the end of a chunk, the next chunk is loaded. You also have the option to preload multiple chunks ahead by pressing the load next chunk feature.
	- Chunk system has a safety check to prevent backend query spam and will skip if a chunk load is in progress
	- Can manually load the next chunk via button
- Removed particles and nonsense effects and buttons such as strobe.
- Further reduced code stack (needs further improvementGive )
- Backend GraphQL is properly using stash schema rather than guessing
---
### QOL Improvements

- Respects filter context 
	- Note: For the most part, it will not work if you have an exclusion in front of your inclusion meaning the INCLUDE must come before the EXCLUDE or no exclude at all for it to properly function. if the include is after the include, it should work. **If someone out there smarter than me can fix this please help.**
	- Respects ASC\DESC Sort
- Split up the image-deck.js into a more manageable format
	- button.js
	- config.js
	- context.js
	- controls.js
	- deck.js
	- graphql.js
	- main.js
	- metadata.js
	- styles.css
	- swiper.js
	- ui.js
	- utils.js
- When in a gallery, it will remember where you left off
- Focused view over original card view (no more cards behind cards)
- Buttons and text fade out when zoomed in
---
## Bug Fixes

- Corrected all logic in relation to splitting the original image-deck.js into a more manageable package base.
- Fix button appearance context
- Made image context more strict, no studio images in reel or other images not relevant to that specific content
- Cleaned up comments
- General formatting
- Fixed card positioning and centering\sync issues
- Corrected filter logic for ASC and DESC, now displays sort correctly
- Removed card looping, caused too many issues
- Removed cards from behind main card, distracting, added no value, buggy
- Removed additional code bloat such as strobe, particles, other nonsense effects
- Major performance enhancements regarding logic and effect usage
- All galleries follow same logic
	- This corrects the incorrect image count display, ghost slides, and looping of the same images for small galleries
- Most if not all backend errors fixed
- Image and gallery counter fixed and showing correct values
- No more ghost slides and images
- Fixed Album 'State' context
- Improved time click to launch for image galleries in the millions  (With 3.3mil images it loads in the milliseconds )
- Nav buttons all function correctly
- Improved all gesture performance response
- removed swipe down to close on fullscreen
- increased threshold for close and accidental swipe gestures
- 'i' or metadata button now displays correctly on both mobile and desktop it is responsive in galleries but currently none functional at the moment in that mode
---

## Known issues

- Zoom buttons appear for galleries if swiping on mobile/desktop past the 10th display
- Filter exclusion issue mentioned in QOL Improvements
- When using keyboard keys on desktop, you will get a console error related to the chunk system. This is a minor bug IMO opinion as the safety logic continues to the core functionality without interruption. At worse you dont preload a chunk until you reach the end it however clicking the nav buttons the chunk system works without issue. This does not cause performance overhead, and is technically a performance improvement though it will be addressed.
- CSS stylesheet needs to be cleaned up
- additional code cleanup needs to be performed
- Metadata use and tagging is very barebones for now, will be modified at a later time
