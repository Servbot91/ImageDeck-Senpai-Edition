import { initialize, initPlugin } from './ui.js';
import './styles.css';

// Initialize app once DOM is ready
function initApp() {
    initialize();
    initPlugin(); // Start the observer
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Track last known URL to detect navigation changes
let lastUrl = location.href;

// Centralized navigation handler
function handleNavigation() {
    // Avoid redundant processing
    if (lastUrl === location.href) return;
    lastUrl = location.href;

    // Clean up previous UI elements
    const existingButton = document.querySelector('.image-deck-launch-btn');
    if (existingButton) existingButton.remove();

    const existingDeck = document.querySelector('.image-deck-container');
    if (existingDeck) {
        existingDeck.remove();
        document.body.classList.remove('image-deck-open');
    }
}

// Enhance history methods to detect SPA navigations
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
    originalPushState.apply(history, arguments);
    handleNavigation();
};

history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    handleNavigation();
};

// Listen for back/forward navigation
window.addEventListener('popstate', handleNavigation);

// Polling fallback (only if necessary for specific router implementations)
setInterval(handleNavigation, 500);
