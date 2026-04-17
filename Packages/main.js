import { initialize } from './ui.js';
import './styles.css';
function initApp() {
    initialize();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
let lastUrl = location.href;
function handleNavigation() {
    if (lastUrl === location.href) return;
    lastUrl = location.href;
    const existingButton = document.querySelector('.image-deck-launch-btn');
    if (existingButton) existingButton.remove();

    const existingDeck = document.querySelector('.image-deck-container');
    if (existingDeck) {
        existingDeck.remove();
        document.body.classList.remove('image-deck-open');
    }
}

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
    originalPushState.apply(history, arguments);
    setTimeout(handleNavigation, 100);
};

history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    setTimeout(handleNavigation, 100);
};

window.addEventListener('popstate', () => {
    setTimeout(handleNavigation, 100);
});
setInterval(handleNavigation, 500);
