import * as dom from './dom.js';
import * as config from './config.js';
import { getState, updateState } from './state.js';
import { shuffle } from './utils.js';

/**
 * Triggers the animation for the Necro X ability.
 */
export const animateNecroX = () => {
    const { gameState } = getState();
    const overlay = document.getElementById('necro-x-animation-overlay');
    const casterImg = document.getElementById('necro-x-caster-img');

    if (overlay && casterImg) {
        casterImg.classList.toggle('final-boss-glow', gameState.isFinalBoss);
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('hidden'), 2500);
    }
};

/**
 * Creates and starts the falling animation for the secret Versatrix card on the splash screen.
 * This now uses a chained timeout to create a more reliable loop.
 */
const startVersatrixCardAnimation = () => {
    const { versatrixCardInterval } = getState();
    // Clear any previously running interval to prevent duplicates
    if (versatrixCardInterval) clearInterval(versatrixCardInterval);

    const fallDuration = 15000;
    const pauseDuration = 10000;
    const totalCycle = fallDuration + pauseDuration;

    const createCard = () => {
        // Prevent creating a new card if one is already falling
        if (document.getElementById('secret-versatrix-card')) return;
        
        const card = document.createElement('div');
        card.id = 'secret-versatrix-card';
        card.style.left = `${Math.random() * 80 + 10}vw`; // Avoid edges
        
        dom.splashAnimationContainerEl.appendChild(card);
        
        // Remove the card after its animation finishes
        setTimeout(() => {
            if (card.parentElement) {
                 card.remove();
            }
        }, fallDuration);
    };

    // Create the first card immediately, then set an interval for subsequent cycles
    createCard();
    const interval = setInterval(createCard, totalCycle);
    updateState('versatrixCardInterval', interval);
};


/**
 * Creates and starts the floating items animation for the splash screen or Reversus Total effect.
 * @param {HTMLElement} containerEl - The container element to fill with animated items.
 */
export const initializeFloatingItemsAnimation = (containerEl) => {
    containerEl.innerHTML = '';
    const { achievements } = getState();
    
    // Check for secret card unlock condition
    if (achievements.has('versatrix_win') && !achievements.has('versatrix_card_collected')) {
        startVersatrixCardAnimation();
    }

    // Pool of card images
    const imagePool = [...config.ALL_CARD_IMAGES];
    if (achievements.has('contravox_win')) {
        imagePool.push('cartacontravox.png');
    }

    // Pool of effect names
    const effectNamePool = config.EFFECT_DECK_CONFIG.map(item => item.name);

    const itemsToCreate = [];
    const totalItems = 30;
    const numCards = 15;

    for (let i = 0; i < totalItems; i++) {
        itemsToCreate.push({ type: i < numCards ? 'card' : 'text' });
    }

    shuffle(itemsToCreate);

    for (const itemConfig of itemsToCreate) {
        const item = document.createElement('div');
        item.classList.add('animated-item');
        
        if (itemConfig.type === 'card') {
            item.classList.add('card-shape');
            const imageUrl = imagePool[Math.floor(Math.random() * imagePool.length)];
            item.style.backgroundImage = `url('./${imageUrl}')`;
            const size = Math.random() * 60 + 50; // 50px to 110px width
            item.style.width = `${size}px`;
            item.style.height = `${size * 1.4}px`;
        } else { // type === 'text'
            item.classList.add('text-shape');
            const effectName = effectNamePool[Math.floor(Math.random() * effectNamePool.length)];
            item.textContent = effectName;
            const fontSize = Math.random() * 1.5 + 1; // 1rem to 2.5rem
            item.style.fontSize = `${fontSize}rem`;


            // Add color classes based on effect name from CSS
            switch (effectName) {
                case 'Mais':
                case 'Sobe':
                    item.classList.add('positive');
                    break;
                case 'Menos':
                case 'Desce':
                    item.classList.add('negative');
                    break;
                case 'Pula':
                    item.classList.add('pula');
                    break;
                case 'Reversus':
                    item.classList.add('reversus');
                    break;
                case 'Reversus Total':
                    item.classList.add('reversus-total');
                    break;
            }
        }

        item.style.left = `${Math.random() * 100}vw`;
        const duration = Math.random() * 25 + 15; // 15-40 seconds
        item.style.animationDuration = `${duration}s`;
        item.style.animationDelay = `-${Math.random() * duration}s`;

        containerEl.appendChild(item);
    }
};

/**
 * Toggles the visibility and animation of the Reversus Total background effect.
 * @param {boolean} isActive - Whether to activate or deactivate the effect.
 */
export const toggleReversusTotalBackground = (isActive) => {
    if (isActive) {
        initializeFloatingItemsAnimation(dom.reversusTotalBgAnimationEl);
        dom.reversusTotalBgAnimationEl.classList.remove('hidden');
    } else {
        dom.reversusTotalBgAnimationEl.classList.add('hidden');
        dom.reversusTotalBgAnimationEl.innerHTML = '';
    }
};

/**
 * Creates a shattering effect for an image element.
 * @param {HTMLElement} imageEl - The image element to shatter.
 * @returns {Promise<void>} A promise that resolves when the animation is complete.
 */
export async function shatterImage(imageEl) {
    const parent = imageEl.parentNode;
    if (!parent) return;

    // Create a container for the particles at the same position as the image
    const container = document.createElement('div');
    container.className = 'shatter-container';
    container.style.position = 'absolute';
    const rect = imageEl.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    container.style.left = `${rect.left - parentRect.left}px`;
    container.style.top = `${rect.top - parentRect.top}px`;
    container.style.width = `${rect.width}px`;
    container.style.height = `${rect.height}px`;

    parent.appendChild(container);
    imageEl.style.opacity = '0'; // Hide the original image

    const particles = [];
    const rows = 10, cols = 10;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const particle = document.createElement('div');
            particle.className = 'shatter-particle';
            particle.style.backgroundImage = `url(${imageEl.src})`;
            particle.style.backgroundPosition = `${c * 100 / (cols - 1)}% ${r * 100 / (rows - 1)}%`;
            container.appendChild(particle);
            particles.push(particle);
        }
    }

    // Animate particles flying out
    particles.forEach(p => {
        const x = (Math.random() - 0.5) * window.innerWidth * 1.5;
        const y = (Math.random() - 0.5) * window.innerHeight * 1.5;
        const rot = (Math.random() - 0.5) * 720;
        p.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
        p.style.opacity = '0';
    });

    // Wait for animation to finish then clean up
    return new Promise(resolve => {
        setTimeout(() => {
            container.remove();
            resolve();
        }, 1500);
    });
}