

import * as config from './config.js';
import * as dom from './dom.js';
import { getState, updateState } from './state.js';
import { renderAll, updateTurnIndicator, showTurnIndicator, showRoundSummaryModal, renderPlayerArea, renderBoard, showGameOver, renderCard, showSplashScreen } from './ui.js';
import { playStoryMusic, stopStoryMusic, announceEffect, playSoundEffect } from './sound.js';
import { triggerFieldEffects, tryToSpeak, triggerNecroX } from './story-abilities.js';
import { updateLog, shuffle, createDeck } from './utils.js';
import { grantAchievement } from './achievements.js';
import { animateCardPlay, showInversusVictoryAnimation, toggleReversusTotalBackground } from './animations.js';
import { getGeminiAiMove } from './gemini-ai.js';

/**
 * Handles dealing a card from a specified deck, reshuffling from the discard pile if empty.
 * @param {('value'|'effect')} deckType - The type of deck to draw from.
 * @returns {object | null} The card object, or null if no cards are available.
 */
function dealCard(deckType) {
    const { gameState } = getState();
    if (gameState.decks[deckType].length === 0) {
        updateLog(`Reabastecendo o baralho de ${deckType === 'value' ? 'valor' : 'efeito'}...`);
        if (gameState.discardPiles[deckType].length === 0) {
            // This is a safety net. In theory, should not be reached if discard piles work.
            const configDeck = deckType === 'value' ? config.VALUE_DECK_CONFIG : config.EFFECT_DECK_CONFIG;
            gameState.decks[deckType] = shuffle(createDeck(configDeck, deckType));
            updateLog(`O baralho de ${deckType} e o descarte estavam vazios. Um novo baralho foi criado.`);
            if (gameState.decks[deckType].length === 0) {
                 console.error(`Falha catastrófica ao recriar o baralho de ${deckType}`);
                 return null;
            }
        } else {
            gameState.decks[deckType] = shuffle([...gameState.discardPiles[deckType]]);
            gameState.discardPiles[deckType] = [];
        }
    }
    return gameState.decks[deckType].pop();
}


/**
 * Updates the in-game timer display, handling normal and countdown modes.
 */
export const updateGameTimer = () => {
    const { gameStartTime, gameState, gameTimerInterval } = getState();
    if (!gameStartTime || !gameState) return;
    
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    gameState.elapsedSeconds = elapsed; // Persist elapsed time for snapshots

    if (gameState.currentStoryBattle === 'necroverso_final') {
        const totalSeconds = 20 * 60; // 20 minutes countdown
        const remaining = totalSeconds - elapsed;
        
        if (remaining <= 0) {
            dom.gameTimerContainerEl.textContent = '00:00';
            if(gameTimerInterval) clearInterval(gameTimerInterval);
            updateState('gameTimerInterval', null);
            // Dispatch event only once
            if (gameState.gamePhase !== 'game_over') {
                document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_final', won: false, reason: 'time' } }));
            }
            return;
        }

        // Warning class is now set at the start of the game
        const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
        const seconds = (remaining % 60).toString().padStart(2, '0');
        dom.gameTimerContainerEl.textContent = `${minutes}:${seconds}`;
    } else {
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        dom.gameTimerContainerEl.textContent = `${minutes}:${seconds}`;
    }
};

/**
 * Displays a fullscreen announcement for final bosses.
 * @param {string} text - The dialogue text.
 * @param {string} imageSrc - The source URL for the character image.
 */
const showFullscreenAnnounce = async (text, imageSrc) => {
    return new Promise(resolve => {
        dom.fullscreenAnnounceModal.classList.remove('hidden');
        dom.fullscreenAnnounceModal.classList.add('psychedelic-bg');
        dom.fullscreenAnnounceImage.src = imageSrc;
        dom.fullscreenAnnounceText.textContent = text;
        
        setTimeout(() => {
            dom.fullscreenAnnounceModal.classList.add('hidden');
            dom.fullscreenAnnounceModal.classList.remove('psychedelic-bg');
            resolve();
        }, 5000); // Show for 5 seconds
    });
};


/**
 * Generates the paths and spaces for the game board, including special effect spaces.
 * @param {object} options - Options to customize the board.
 * @returns {Array<object>} An array of path objects.
 */
const generateBoardPaths = (options = {}) => {
    const paths = [];
    const allPositiveEffects = Object.keys(config.POSITIVE_EFFECTS);
    const allNegativeEffects = Object.keys(config.NEGATIVE_EFFECTS);

    for (let i = 0; i < config.NUM_PATHS; i++) {
        const spaces = Array.from({ length: config.BOARD_SIZE }, (_, j) => ({
            id: j + 1, color: 'white', effectName: null, isUsed: false
        }));
        
        // Golden Rule: Spaces 1 and 9 are never colored.
        const colorableSpaceIds = Array.from({ length: 7 }, (_, j) => j + 2); // Spaces 2 through 8
        shuffle(colorableSpaceIds);
        let currentSpaceIndex = 0;

        // Black holes for final boss or king battle
        if (options.isFinalBoss || options.storyBattle === 'necroverso_king') {
            let numBlackHoles;
            if (options.storyBattle === 'necroverso_king') {
                numBlackHoles = 1; // Exactly one for the 1v3 battle.
            } else { // This implies necroverso_final
                numBlackHoles = Math.random() > 0.5 ? 2 : 1; // Keep old logic for the 2v2 battle.
            }
            
            for(let k = 0; k < numBlackHoles && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToBlacken = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                if (spaceToBlacken) spaceToBlacken.color = 'black';
                currentSpaceIndex++;
            }
        }
        
        // Star spaces for Xael Challenge
        if (options.isXaelChallenge) {
            const numStarSpaces = 1;
            for (let k = 0; k < numStarSpaces && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToStar = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                if (spaceToStar) spaceToStar.color = 'star';
                currentSpaceIndex++;
            }
        }

        // Red, Blue, and Yellow for Narrator battle
        if (options.storyBattle === 'narrador') {
            const colors = ['red', 'blue', 'yellow'];
            for(let k = 0; k < colors.length && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToColor = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                if (spaceToColor) {
                    spaceToColor.color = colors[k];
                    // Narrator doesn't use named field effects, just color logic.
                }
                currentSpaceIndex++;
            }
        } else {
             // Blue/Red spaces
            const numBlueRed = options.isFinalBoss ? 1 : config.COLORED_SPACES_PER_PATH;
            for (let k = 0; k < numBlueRed && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToColor = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                const isReversumBattle = options.storyBattle === 'reversum';
                const isPositive = isReversumBattle ? false : (Math.random() > 0.5);
                 if (spaceToColor) {
                    if (isPositive) {
                        spaceToColor.color = 'blue';
                        spaceToColor.effectName = shuffle([...allPositiveEffects])[0];
                    } else {
                        spaceToColor.color = 'red';
                        spaceToColor.effectName = shuffle([...allNegativeEffects])[0];
                    }
                }
                currentSpaceIndex++;
            }
            
            // Yellow spaces
            const isVersatrixBattle = options.storyBattle === 'versatrix' || options.isFinalBoss;
            if (isVersatrixBattle && currentSpaceIndex < colorableSpaceIds.length) {
                const numYellow = 1;
                 for (let k = 0; k < numYellow && currentSpaceIndex < colorableSpaceIds.length; k++) {
                    const spaceToYellow = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                    if (spaceToYellow) spaceToYellow.color = 'yellow';
                    currentSpaceIndex++;
                 }
            }
        }
        
        const playerId = i < config.MASTER_PLAYER_IDS.length ? config.MASTER_PLAYER_IDS[i] : null;
        paths.push({ id: i, playerId, spaces });
    }
    return paths;
};

/**
 * Initializes a new game with the specified mode and options.
 */
export const initializeGame = async (mode, options) => {
    Object.assign(config.PLAYER_CONFIG, structuredClone(config.originalPlayerConfig));
    updateState('reversusTotalIndividualFlow', false); // Reset flow state
    
    // Handle overrides from either PvP lobby or Story Mode
    const overrides = options.story ? options.story.overrides : options.overrides;
    if (overrides) {
        for (const id in overrides) {
            if (config.PLAYER_CONFIG[id]) {
                Object.assign(config.PLAYER_CONFIG[id], overrides[id]);
            }
        }
    }
    
    let playerIdsInGame, numPlayers, modeText, isStoryMode = false, isFinalBoss = false, storyBattle = null, storyBattleType = null, isInversusMode = false, isXaelChallenge = false;

    if (mode === 'inversus') {
        isInversusMode = true;
        numPlayers = 2;
        playerIdsInGame = config.MASTER_PLAYER_IDS.slice(0, numPlayers);
        modeText = 'Modo Inversus';
        dom.splashScreenEl.classList.add('hidden');
        playStoryMusic('inversus.ogg');

        // Clear previous interval if any
        const { inversusAnimationInterval } = getState();
        if (inversusAnimationInterval) clearInterval(inversusAnimationInterval);

        const inversusImages = ['inversum1.png', 'inversum2.png', 'inversum3.png'];
        let imageIndex = 0;
        const intervalId = setInterval(() => {
            const imgEl = document.getElementById('inversus-character-portrait');
            if (imgEl) {
                imageIndex = (imageIndex + 1) % inversusImages.length;
                imgEl.src = inversusImages[imageIndex];
            }
        }, 2000); // Change image every 2 seconds
        updateState('inversusAnimationInterval', intervalId);
    } else if (options.story) {
        isStoryMode = true;
        storyBattle = options.story.battle;
        if (options.story.playerIds) {
            playerIdsInGame = options.story.playerIds;
        } else {
            // Fallback for lobby-initiated story battles that respect lobby player count
            playerIdsInGame = config.MASTER_PLAYER_IDS.slice(0, options.numPlayers);
        }
        numPlayers = playerIdsInGame.length;
        storyBattleType = options.story.type || null;
        isFinalBoss = storyBattle === 'necroverso_final' || storyBattle === 'necroverso_king';
        isXaelChallenge = storyBattle === 'xael_challenge';
        
        switch(storyBattle) {
            case 'contravox': modeText = 'Modo História: Contravox'; playStoryMusic('contravox.ogg'); break;
            case 'versatrix': modeText = 'Modo História: Versatrix'; playStoryMusic('versatrix.ogg'); break;
            case 'reversum': modeText = 'Modo História: Rei Reversum'; playStoryMusic('reversum.ogg'); break;
            case 'necroverso_king': modeText = 'Modo História: Rei Necroverso'; playStoryMusic('necroverso.ogg'); break;
            case 'necroverso_final': modeText = 'Modo História: Necroverso Final'; playStoryMusic('necroversofinal.ogg'); break;
            case 'narrador': modeText = 'Batalha Secreta: Narrador'; playStoryMusic('narrador.ogg'); break;
            case 'xael_challenge': modeText = 'Desafio: Xael'; playStoryMusic('xaeldesafio.ogg'); break;
            default: modeText = `Modo História: ${storyBattle}`; stopStoryMusic();
        }
    } else {
        numPlayers = options.numPlayers;
        playerIdsInGame = config.MASTER_PLAYER_IDS.slice(0, numPlayers);
        modeText = mode === 'solo' ? `Solo (${numPlayers}p)` : 'Duplas';
        stopStoryMusic();
    }

    // Clear any leftover complex state
    updateState('pathSelectionResolver', null);
    
    // Announce final boss battles before showing the game screen
    if (storyBattle === 'necroverso_king') {
        await showFullscreenAnnounce("Será capaz de vencer este desafio contra nós três?", 'necroversorevelado.png');
    } else if (storyBattle === 'necroverso_final') {
        await showFullscreenAnnounce("Nem mesmo com ajuda da Versatrix poderá me derrotar, eu dominarei o Inversum e consumirei TUDO", 'necroversorevelado.png');
    }


    dom.gameSetupModal.classList.add('hidden');
    dom.storyModeModalEl.classList.add('hidden');
    dom.pvpRoomListModal.classList.add('hidden');
    dom.pvpLobbyModal.classList.add('hidden');
    dom.appContainerEl.classList.remove('blurred', 'hidden');
    dom.reversusTotalIndicatorEl.classList.add('hidden');
    dom.debugButton.classList.remove('hidden');
    dom.boardEl.classList.remove('inverted'); // Reset board direction
    dom.boardEl.classList.toggle('final-battle-board', isFinalBoss);
    dom.boardEl.classList.toggle('board-rotating', isInversusMode);
    
    // Apply narrator monitor effect
    dom.appContainerEl.classList.toggle('effect-monitor', storyBattle === 'narrador');

    const state = getState();
    if (!isStoryMode && !isInversusMode) {
        stopStoryMusic();
        updateState('currentTrackIndex', 0);
        dom.musicPlayer.src = config.MUSIC_TRACKS[state.currentTrackIndex];
    }
    
    dom.gameTimerContainerEl.classList.remove('countdown-warning');
    if (storyBattle === 'necroverso_final') {
        dom.gameTimerContainerEl.classList.add('countdown-warning');
    }
    if (state.gameTimerInterval) clearInterval(state.gameTimerInterval);
    updateState('gameStartTime', Date.now());
    updateGameTimer();
    updateState('gameTimerInterval', setInterval(updateGameTimer, 1000));
    
    const valueDeck = shuffle(createDeck(config.VALUE_DECK_CONFIG, 'value'));
    const effectDeck = shuffle(createDeck(config.EFFECT_DECK_CONFIG, 'effect'));

    const players = Object.fromEntries(
        playerIdsInGame.map((id, index) => {
            const playerObject = {
                ...config.PLAYER_CONFIG[id],
                id,
                aiType: config.PLAYER_CONFIG[id].aiType || 'default',
                pathId: isInversusMode ? -1 : index,
                position: 1,
                hand: [],
                resto: null,
                nextResto: null,
                effects: { score: null, movement: null },
                playedCards: { value: [], effect: [] },
                playedValueCardThisTurn: false,
                targetPathForPula: null,
                liveScore: 0,
                status: 'neutral', // neutral, winning, losing
                isEliminated: false,
            };
            if (isInversusMode) {
                playerObject.hearts = 10;
                playerObject.maxHearts = 10;
            }
             if (storyBattle === 'narrador' && id === 'player-2') {
                playerObject.narratorAbilities = {
                    confusion: true,
                    reversus: true,
                    necroX: true
                };
            }
            if (isXaelChallenge) {
                playerObject.stars = 0;
                playerObject.hasXaelStarPower = (id === 'player-1');
                playerObject.xaelStarPowerCooldown = 0;
            }
            return [id, playerObject];
        })
    );
    
    const boardPaths = generateBoardPaths({ storyBattle, isFinalBoss, isXaelChallenge });
    if (!isFinalBoss && !isInversusMode && !isXaelChallenge) {
        playerIdsInGame.forEach((id, index) => { 
            if(boardPaths[index]) boardPaths[index].playerId = id; 
        });
    }

    const gameState = {
        players,
        playerIdsInGame,
        decks: { value: valueDeck, effect: effectDeck },
        discardPiles: { value: [], effect: [] },
        boardPaths,
        gamePhase: 'setup',
        gameMode: mode,
        isStoryMode,
        isInversusMode,
        isFinalBoss,
        isXaelChallenge,
        necroversoHearts: 3,
        currentStoryBattle: storyBattle,
        storyBattleType: storyBattleType,
        currentPlayer: 'player-1',
        reversusTotalActive: false,
        inversusTotalAbilityActive: false,
        turn: 1,
        selectedCard: null,
        reversusTarget: null,
        pulaTarget: null,
        fieldEffectTargetingInfo: null,
        log: [],
        activeFieldEffects: [],
        revealedHands: [],
        consecutivePasses: 0,
        playedAnyCardThisTurn: false,
        initialDrawCards: null,
        contravoxAbilityUses: 3,
        versatrixSwapActive: false,
        versatrixPowerDisabled: false,
        reversumAbilityUsedThisRound: false,
        necroXUsedThisRound: false,
        dialogueState: { spokenLines: new Set() }, // Initialize dialogue state
        player1CardsObscured: false, // For Contravox ability
        xaelChallengeOffered: false, // For secret Xael challenge
        elapsedSeconds: 0,
    };
    
    if (isFinalBoss) {
        // Paths are now fixed at the start
    }

    updateState('gameState', gameState);

    if (dom.leftScoreBox && dom.rightScoreBox) {
        if (isInversusMode) {
            dom.leftScoreBox.classList.add('hidden');
            dom.rightScoreBox.classList.add('hidden');
        } else {
            dom.leftScoreBox.classList.remove('hidden');
            dom.rightScoreBox.classList.remove('hidden');
        }
    }
    
    const player1Container = document.getElementById('player-1-area-container');
    const opponentsContainer = document.getElementById('opponent-zones-container');
    const createPlayerAreaHTML = (id) => `<div class="player-area" id="player-area-${id}"></div>`;
    player1Container.innerHTML = createPlayerAreaHTML('player-1');
    opponentsContainer.innerHTML = playerIdsInGame.filter(id => id !== 'player-1').map(id => createPlayerAreaHTML(id)).join('');

    updateLog(`Bem-vindo ao Reversus! Modo: ${modeText}.`);
    if(mode === 'duo' && !isStoryMode) updateLog("Equipe Azul/Verde (Você & Jogador 3) vs. Equipe Vermelho/Amarelo (Jogador 2 & Jogador 4)");
    
    renderAll();
    
    await initiateGameStartSequence();
};

export async function initiateGameStartSequence() {
    const { gameState } = getState();
    if (gameState.isInversusMode) {
        await startNewRound(true);
        return;
    }
    
    // Skip initial draw for the final battle or Xael challenge
    if (gameState.isFinalBoss || gameState.isXaelChallenge) {
        // Set paths once at the start
        const chosenPaths = new Set();
        const playerIdsToAssign = gameState.playerIdsInGame;
        playerIdsToAssign.forEach(id => {
            let availablePaths = gameState.boardPaths.filter(p => !chosenPaths.has(p.id));
            if (availablePaths.length > 0) {
                let chosenPath = shuffle(availablePaths)[0];
                gameState.players[id].pathId = chosenPath.id;
                chosenPaths.add(chosenPath.id);
            }
        });
        
        await startNewRound(true);
        return;
    }

    dom.drawStartTitle.textContent = "Sorteio Inicial";
    dom.drawStartResultMessage.textContent = "Sorteando cartas para ver quem começa...";
    
    dom.drawStartCardsContainerEl.innerHTML = gameState.playerIdsInGame.map(id => {
        const player = gameState.players[id];
        return `
            <div class="draw-start-player-slot">
                <span class="player-name ${id}">${player.name}</span>
                <div class="card modal-card" style="background-image: url('verso_valor.png');" id="draw-card-${id}"></div>
            </div>
        `;
    }).join('');

    dom.drawStartModal.classList.remove('hidden');
    await new Promise(res => setTimeout(res, 1500));
    await drawToStart();
};

async function drawToStart() {
    const { gameState } = getState();

    const drawnCards = {};
    const cardPromises = [];

    gameState.playerIdsInGame.forEach((id, index) => {
        const card = dealCard('value');
        if (!card) {
            console.error("Failed to draw card for initial draw.");
            return;
        }
        drawnCards[id] = card;
        const cardEl = document.getElementById(`draw-card-${id}`);
        
        const promise = new Promise(res => {
            setTimeout(() => {
                if(cardEl) cardEl.outerHTML = renderCard(card, 'modal');
                res();
            }, 500 * index);
        });
        cardPromises.push(promise);
    });

    await Promise.all(cardPromises);

    await new Promise(res => setTimeout(res, 1500));

    const sortedPlayers = gameState.playerIdsInGame.sort((a, b) => drawnCards[b].value - drawnCards[a].value);
    const logParts = gameState.playerIdsInGame.map(id => `${gameState.players[id].name} sacou ${drawnCards[id].name}`);
    updateLog(`Sorteio: ${logParts.join(', ')}.`);
    
    if (sortedPlayers.length < 2 || drawnCards[sortedPlayers[0]].value > drawnCards[sortedPlayers[1]].value) {
        const winner = gameState.players[sortedPlayers[0]];
        gameState.currentPlayer = winner.id;
        gameState.initialDrawCards = drawnCards;
        dom.drawStartResultMessage.textContent = `${winner.name} tirou a carta mais alta e começa!`;
        
        await new Promise(res => setTimeout(res, 2000));
        dom.drawStartModal.classList.add('hidden');
        
        await finalizeGameStart();
    } else {
        dom.drawStartResultMessage.textContent = "Empate! Sorteando novamente...";
        updateLog("Empate! Sacando novas cartas...");
        Object.values(drawnCards).forEach(card => gameState.discardPiles.value.push(card));
        await initiateGameStartSequence();
    }
};

async function finalizeGameStart() {
    const { gameState } = getState();
    
    if (gameState.initialDrawCards) {
        gameState.playerIdsInGame.forEach(id => {
            gameState.players[id].resto = gameState.initialDrawCards[id];
            updateLog(`Resto inicial de ${gameState.players[id].name} é ${gameState.initialDrawCards[id].name}.`);
        });
    }
    
    await startNewRound(true);
};

export function applyEffect(card, targetId, casterName, effectTypeToReverse) {
    const { gameState } = getState();
    const target = gameState.players[targetId];
    if (!target) return;

    let effectName = card.name;

    if (gameState.activeFieldEffects.some(fe => fe.name === 'Imunidade' && fe.appliesTo === targetId) && (effectName === 'Menos' || effectName === 'Desce')) {
        updateLog(`${target.name} está imune a ${effectName} nesta rodada!`);
        return;
    }

    const getInverseEffect = (effect) => {
        const map = { 'Mais': 'Menos', 'Menos': 'Mais', 'Sobe': 'Desce', 'Desce': 'Sobe', 'NECRO X': 'NECRO X Invertido', 'NECRO X Invertido': 'NECRO X' };
        return map[effect] || null;
    };

    if (gameState.reversusTotalActive && effectName !== 'Reversus Total') {
        const inverted = getInverseEffect(effectName);
        if (inverted) {
            updateLog(`Reversus Total inverteu ${card.name} para ${inverted}!`);
            effectName = inverted;
        }
    }
    
    if (card.isLocked) {
        announceEffect("REVERSUS INDIVIDUAL!", 'reversus');
    } else if (card.name !== 'Carta da Versatrix' && !['Reversus', 'Reversus Total'].includes(card.name)) {
        announceEffect(effectName);
    }

    switch (effectName) {
        case 'Mais': case 'Menos': case 'NECRO X': case 'NECRO X Invertido':
            target.effects.score = effectName;
            break;
        case 'Sobe': case 'Desce': case 'Pula':
            target.effects.movement = effectName;
            break;
        case 'Reversus': {
            announceEffect('Reversus!', 'reversus');
            if (effectTypeToReverse === 'score') {
                target.effects.score = getInverseEffect(target.effects.score);
                updateLog(`${casterName} usou ${card.name} em ${target.name} para reverter efeito de pontuação para ${target.effects.score || 'Nenhum'}.`);
            } else if (effectTypeToReverse === 'movement') {
                if (target.effects.movement === 'Pula') {
                    target.effects.movement = null;
                    updateLog(`${casterName} anulou o efeito 'Pula' de ${target.name} com Reversus!`);
                } else {
                    target.effects.movement = getInverseEffect(target.effects.movement);
                    updateLog(`${casterName} usou ${card.name} em ${target.name} para reverter efeito de movimento para ${target.effects.movement || 'Nenhum'}.`);
                }
            }
            return;
        }
        case 'Reversus Total': {
            announceEffect('Reversus Total!', 'reversus-total');
            playSoundEffect('reversustotal');
            toggleReversusTotalBackground(true);
            gameState.reversusTotalActive = true;
            dom.appContainerEl.classList.add('reversus-total-active');
            dom.reversusTotalIndicatorEl.classList.remove('hidden');
            Object.values(gameState.players).forEach(p => {
                const scoreEffectCard = p.playedCards.effect.find(c => ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido'].includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'score'));
                if (p.effects.score && (!scoreEffectCard || !scoreEffectCard.isLocked)) {
                    p.effects.score = getInverseEffect(p.effects.score);
                }
                const moveEffectCard = p.playedCards.effect.find(c => ['Sobe', 'Desce', 'Pula'].includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'movement'));
                if (p.effects.movement && p.effects.movement !== 'Pula' && (!moveEffectCard || !moveEffectCard.isLocked)) {
                    p.effects.movement = getInverseEffect(p.effects.movement);
                }
            });
            updateLog(`${casterName} ativou o Reversus Total!`);
            
            // XAEL POPUP TRIGGER
            if (gameState.isStoryMode && !gameState.xaelChallengeOffered && !gameState.isInversusMode) {
                gameState.xaelChallengeOffered = true; // Mark as offered to prevent repeats
                setTimeout(() => {
                    playSoundEffect('xael');
                    dom.xaelPopup.classList.remove('hidden');
                    updateLog("Um Desafiante secreto apareceu!");
                }, 1000); // 1 second delay
            }
            return;
        }
        case 'Carta da Versatrix':
            target.effects.score = 'Mais';
            updateLog(`${casterName} usou a ${card.name} em ${target.name}, garantindo o efeito 'Mais'.`);
            break;
    }

    if (card.name === 'Pula') {
        updateLog(`${casterName} usou ${card.name} em ${target.name}.`);
    } else if (card.name !== 'Reversus' && card.name !== 'Reversus Total' && card.name !== 'Carta da Versatrix') {
        updateLog(`${casterName} usou ${card.name} em ${target.name} para aplicar o efeito ${effectName}.`);
    }
}

export async function playCard(player, card, targetId, effectTypeToReverse = null, options = {}) {
    const { gameState } = getState();

    // 1. Determine animation target and where the card will be stored.
    let animationTargetPlayerId = player.id;
    let cardDestinationPlayer = player;

    if (card.type === 'effect') {
        // Effect cards are animated to the target and stored in the target's played cards.
        animationTargetPlayerId = targetId;
        cardDestinationPlayer = gameState.players[targetId];
    }

    // Exception: 'Reversus Total' is a global effect. It is animated to and stored in the caster's area.
    if (card.name === 'Reversus Total' && !options.isIndividualLock) {
        animationTargetPlayerId = player.id;
        cardDestinationPlayer = player;
    }

    // 2. Find the card element in the hand to start the animation from.
    const startCardElement = document.querySelector(`#hand-${player.id} [data-card-id="${card.id}"]`);

    // 3. Determine the target slot label in the destination player's area.
    let targetSlotLabel = '';
    if (card.type === 'value') {
        targetSlotLabel = cardDestinationPlayer.playedCards.value.length === 0 ? 'Valor 1' : 'Valor 2';
    } else { // Effect cards
        const scoreEffects = ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido', 'Carta da Versatrix'];
        // Use the locked effect name if applicable, otherwise the card's name
        const effectNameForSlot = options.isIndividualLock ? options.effectNameToApply : card.name;

        if (scoreEffects.includes(effectNameForSlot) || (effectNameForSlot === 'Reversus' && effectTypeToReverse === 'score')) {
            targetSlotLabel = 'Pontuação';
        } else if (['Sobe', 'Desce', 'Pula'].includes(effectNameForSlot) || (effectNameForSlot === 'Reversus' && effectTypeToReverse === 'movement')) {
            targetSlotLabel = 'Movimento';
        } else if (effectNameForSlot === 'Reversus Total' && !options.isIndividualLock) {
             targetSlotLabel = 'Reversus T.';
        }
    }
    
    // 4. Animate the card play.
    if (startCardElement && targetSlotLabel) {
        await animateCardPlay(card, startCardElement, animationTargetPlayerId, targetSlotLabel);
    }

    // --- State modifications after animation ---

    // 5. Remove card from player's hand and clear selection.
    player.hand = player.hand.filter(c => c.id !== card.id);
    gameState.selectedCard = null;

    // 6. Update state based on card type.
    if (card.type === 'value') {
        // Value cards are simple. They always apply to the caster.
        player.playedCards.value.push(card);
        player.playedValueCardThisTurn = true;
        player.nextResto = card;
        updateLog(`${player.name} jogou a carta de valor ${card.name}.`);
    } else if (card.type === 'effect') {
        // Effect cards have more complex logic.
        card.casterId = player.id; // Always record who cast it.

        // a. Apply the game logic effect
        if (options.isIndividualLock) {
            card.isLocked = true;
            card.name = options.effectNameToApply;
            updateLog(`${player.name} usou Reversus Total para travar o efeito '${card.name}' em ${gameState.players[targetId].name}.`);
            applyEffect(card, targetId, player.name);
        } else if (card.name === 'Reversus') {
            card.reversedEffectType = effectTypeToReverse;
            applyEffect(card, targetId, player.name, effectTypeToReverse);
        } else {
            applyEffect(card, targetId, player.name);
        }
        
        // b. Place the card visually in the correct slot on the correct player's board.
        const cardToPlaceInSlot = { ...card }; // Clone to avoid mutation issues
        const scoreEffects = ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido', 'Carta da Versatrix'];
        
        let targetSlotType = null;
        if (scoreEffects.includes(cardToPlaceInSlot.name) || (cardToPlaceInSlot.name === 'Reversus' && cardToPlaceInSlot.reversedEffectType === 'score')) {
            targetSlotType = 'score';
        } else if (['Sobe', 'Desce', 'Pula'].includes(cardToPlaceInSlot.name) || (cardToPlaceInSlot.name === 'Reversus' && cardToPlaceInSlot.reversedEffectType === 'movement')) {
            targetSlotType = 'movement';
        } else if (cardToPlaceInSlot.name === 'Reversus Total' && !cardToPlaceInSlot.isLocked) {
             targetSlotType = 'reversus-total';
        }

        // c. If a card of the same type is already in the destination slot, remove it.
        if (targetSlotType) {
            const currentEffects = cardDestinationPlayer.playedCards.effect;
            let oldCardIndex = -1;
            
            // Find the index of the old card to replace
            if (targetSlotType === 'score') {
                oldCardIndex = currentEffects.findIndex(c => scoreEffects.includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'score'));
            } else if (targetSlotType === 'movement') {
                oldCardIndex = currentEffects.findIndex(c => ['Sobe', 'Desce', 'Pula'].includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'movement'));
            } else if (targetSlotType === 'reversus-total') {
                oldCardIndex = currentEffects.findIndex(c => c.name === 'Reversus Total' && !c.isLocked);
            }

            // Remove it if found and add to discard pile
            if (oldCardIndex !== -1) {
                const [oldCard] = currentEffects.splice(oldCardIndex, 1);
                gameState.discardPiles.effect.push(oldCard);
            }
        }
        
        // d. Finally, add the new card to the destination player's effect cards.
        cardDestinationPlayer.playedCards.effect.push(cardToPlaceInSlot);
    }
    
    // 7. Reset turn state and re-render.
    gameState.consecutivePasses = 0;
    gameState.playedAnyCardThisTurn = true;
    renderAll();
    updateTurnIndicator();
}

export async function advanceToNextPlayer() {
    const { gameState } = getState();
    const currentPlayer = gameState.players[gameState.currentPlayer];
    
    if (!gameState.playedAnyCardThisTurn) {
        gameState.consecutivePasses++;
        updateLog(`${currentPlayer.name} passou o turno.`);
    }

    if (await checkRoundEnd()) return;

    const currentIndex = gameState.playerIdsInGame.indexOf(gameState.currentPlayer);
    const nextIndex = (currentIndex + 1) % gameState.playerIdsInGame.length;
    gameState.currentPlayer = gameState.playerIdsInGame[nextIndex];
    
    // Reset turn-specific flags for the new current player
    const newCurrentPlayer = gameState.players[gameState.currentPlayer];
    newCurrentPlayer.playedValueCardThisTurn = false;
    gameState.playedAnyCardThisTurn = false;
    
    renderAll();

    if (newCurrentPlayer.isEliminated) {
        await advanceToNextPlayer();
        return;
    }
    
    if (newCurrentPlayer.isHuman) {
        await showTurnIndicator();
        updateTurnIndicator();
    } else {
        updateTurnIndicator();
        await executeAiTurn(newCurrentPlayer);
    }
}

function getStandardAiMove(player, gameState) {
    const valueCardsInHand = player.hand.filter(c => c.type === 'value');
    const mustPlayValueCard = valueCardsInHand.length >= 2 && !player.playedValueCardThisTurn;

    if (mustPlayValueCard) {
        valueCardsInHand.sort((a, b) => a.value - b.value);
        const cardToPlay = player.status === 'winning' ? valueCardsInHand[0] : valueCardsInHand[valueCardsInHand.length - 1];
        return { action: 'play_card', cardId: cardToPlay.id, targetId: player.id };
    }

    const winningPlayer = Object.values(gameState.players).reduce((prev, curr) => (prev.position > curr.position) ? prev : curr);
    const effectCardsInHand = player.hand.filter(c => c.type === 'effect');

    if (effectCardsInHand.length > 0) {
        const defensivePlay = effectCardsInHand.find(c => c.name === 'Menos' || c.name === 'Desce');
        if (defensivePlay) {
            return { action: 'play_card', cardId: defensivePlay.id, targetId: winningPlayer.id };
        }
        const offensivePlay = effectCardsInHand.find(c => c.name === 'Mais' || c.name === 'Sobe');
        if (offensivePlay) {
            return { action: 'play_card', cardId: offensivePlay.id, targetId: player.id };
        }
    }
    
    return { action: 'pass_turn' };
}

export async function executeAiTurn(player) {
    const { gameState } = getState();
    gameState.gamePhase = 'paused';
    updateTurnIndicator();
    await new Promise(res => setTimeout(res, 1000 + Math.random() * 1500));
    await tryToSpeak(player);

    // Special ability check for Necroverso Final
    if (player.aiType === 'necroverso_final' && !gameState.necroXUsedThisRound && Math.random() < 0.5) {
        await triggerNecroX(player);
        await advanceToNextPlayer();
        return;
    }

    let move;
    try {
        move = await getGeminiAiMove(player, gameState);
        if (!move || !move.action) {
            throw new Error("Gemini returned invalid move, falling back to standard AI.");
        }
        updateLog(`(Gemini) ${player.name} está agindo...`);
    } catch (error) {
        console.warn(`Gemini AI failed for ${player.name}. Error:`, error.message);
        updateLog(`${player.name} está agindo (Padrão)...`);
        move = getStandardAiMove(player, gameState);
    }
    
    gameState.gamePhase = 'playing';
    
    if (move.action === 'pass_turn') {
        await advanceToNextPlayer();
    } else if (move.action === 'play_card' && move.cardId) {
        const cardToPlay = player.hand.find(c => c.id === move.cardId);
        if (cardToPlay) {
            let targetId = move.targetId || player.id;
            // Validate target
            if (!gameState.players[targetId]) {
                console.warn(`AI tried to target invalid player ${targetId}, defaulting to self.`);
                targetId = player.id;
            }
            
            if (cardToPlay.name === 'Reversus') {
                await playCard(player, cardToPlay, targetId, move.effectTypeToReverse || 'score');
            } else {
                await playCard(player, cardToPlay, targetId, null, move.options);
            }
            await advanceToNextPlayer();
        } else {
            console.error(`${player.name} AI tried to play card ID ${move.cardId} which it doesn't have. Passing.`);
            await advanceToNextPlayer();
        }
    }
}

async function startNewRound(isFirstRound = false) {
    const { gameState } = getState();
    updateLog(`--- Iniciando Rodada ${gameState.turn} ---`);

    // Reset round-specific state
    gameState.consecutivePasses = 0;
    gameState.reversusTotalActive = false;
    toggleReversusTotalBackground(false);
    dom.reversusTotalIndicatorEl.classList.add('hidden');
    gameState.activeFieldEffects = [];
    gameState.revealedHands = [];
    gameState.player1CardsObscured = false;
    gameState.reversumAbilityUsedThisRound = false;
    gameState.necroXUsedThisRound = false;
    if (gameState.isXaelChallenge && gameState.players['player-1'].xaelStarPowerCooldown > 0) {
        gameState.players['player-1'].xaelStarPowerCooldown--;
    }


    // Reset players for the new round and return cards to discard piles
    Object.values(gameState.players).forEach(player => {
        gameState.discardPiles.value.push(...player.playedCards.value);
        gameState.discardPiles.effect.push(...player.playedCards.effect);
        player.playedCards = { value: [], effect: [] };
        player.playedValueCardThisTurn = false;
        player.effects = { score: null, movement: null };
        if (player.nextResto) {
            player.resto = player.nextResto;
            player.nextResto = null;
        }
    });

    // Deal cards
    Object.values(gameState.players).forEach(player => {
        while (player.hand.filter(c => c.type === 'value').length < config.MAX_VALUE_CARDS_IN_HAND) {
            const card = dealCard('value');
            if (card) player.hand.push(card);
            else break;
        }
        while (player.hand.filter(c => c.type === 'effect').length < config.MAX_EFFECT_CARDS_IN_HAND) {
            const card = dealCard('effect');
            if (card) player.hand.push(card);
            else break;
        }
    });

    gameState.tutorialEffectCardsLocked = false;
    
    updateState('roundStartStateSnapshot', structuredClone(gameState));
    renderAll();
    
    // Field effects trigger after setup and render
    await triggerFieldEffects();
    
    gameState.gamePhase = 'playing';
    renderAll();
    
    const currentPlayer = gameState.players[gameState.currentPlayer];
    if (currentPlayer.isHuman) {
        await showTurnIndicator();
        updateTurnIndicator();
    } else {
        await executeAiTurn(currentPlayer);
    }
}

async function checkRoundEnd() {
    const { gameState } = getState();
    const totalPlayers = gameState.playerIdsInGame.filter(id => !gameState.players[id].isEliminated).length;
    if (gameState.consecutivePasses >= totalPlayers) {
        await resolveRound();
        return true;
    }
    return false;
}

async function resolveRound() {
    const { gameState } = getState();
    gameState.gamePhase = 'resolution';
    updateTurnIndicator();
    updateLog('Todos passaram. Resolvendo a rodada...');

    const scores = {};
    let highestScore = -Infinity;
    
    Object.values(gameState.players).forEach(p => {
        let score = p.playedCards.value.reduce((sum, card) => sum + card.value, 0);
        const restoValue = p.resto ? p.resto.value : 0;
        
        if (p.effects.score === 'Mais') score += restoValue;
        if (p.effects.score === 'Menos') score -= restoValue;
        if (p.effects.score === 'NECRO X') score += 10;
        if (p.effects.score === 'NECRO X Invertido') score -= 10;

        scores[p.id] = score;
        if (!p.isEliminated && score > highestScore) {
            highestScore = score;
        }
    });

    let winners = gameState.playerIdsInGame.filter(id => !gameState.players[id].isEliminated && scores[id] === highestScore);
    
    if (gameState.gameMode === 'duo') {
        const teamScores = calculateTeamScores(scores);
        const winningTeam = teamScores.teamA > teamScores.teamB ? 'A' : 'B';
        winners = winningTeam === 'A' ? config.TEAM_A.filter(id => gameState.playerIdsInGame.includes(id)) : config.TEAM_B.filter(id => gameState.playerIdsInGame.includes(id));
        updateLog(`Pontuação da Equipe A: ${teamScores.teamA}, Pontuação da Equipe B: ${teamScores.teamB}. Equipe ${winningTeam} venceu a rodada.`);
    }

    await showRoundSummaryModal(winners, scores);

    // Apply movement
    Object.values(gameState.players).forEach(p => {
        if(p.isEliminated) return;
        const isWinner = winners.includes(p.id);
        if (isWinner) p.position++;
        if (p.effects.movement === 'Sobe') p.position++;
        if (p.effects.movement === 'Desce') p.position = Math.max(1, p.position - 1);
        if (p.effects.movement === 'Pula') p.pathId = p.targetPathForPula;
        p.position = Math.min(config.WINNING_POSITION, p.position);
    });
    
    // Speed run achievement check
    if(gameState.turn <= 3 && gameState.players['player-1'].position >= config.WINNING_POSITION) {
        grantAchievement('speed_run');
    }

    renderBoard();
    await new Promise(res => setTimeout(res, 1000));
    
    if (checkWinCondition()) return;

    gameState.turn++;
    await startNewRound();
}

function calculateTeamScores(scores) {
    const teamA_ids = config.TEAM_A.filter(id => getState().gameState.playerIdsInGame.includes(id));
    const teamB_ids = config.TEAM_B.filter(id => getState().gameState.playerIdsInGame.includes(id));
    
    const teamA = teamA_ids.reduce((sum, id) => sum + (scores[id] || 0), 0);
    const teamB = teamB_ids.reduce((sum, id) => sum + (scores[id] || 0), 0);
    return { teamA, teamB };
}


function checkWinCondition() {
    const { gameState } = getState();
    
    // Check win condition for Xael challenge
    if (gameState.isXaelChallenge) {
        const player1 = gameState.players['player-1'];
        const xael = gameState.players['player-2'];
        if (player1.position >= config.WINNING_POSITION || xael.position >= config.WINNING_POSITION) {
            const playerWon = player1.stars > xael.stars;
            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'xael_challenge', won: playerWon } }));
            return true;
        }
    }
    
    // Check win condition for Necroverso King battle
    if (gameState.currentStoryBattle === 'necroverso_king') {
        const kings = [gameState.players['player-2'], gameState.players['player-3'], gameState.players['player-4']];
        if (kings.every(k => k && k.isEliminated)) {
            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_king', won: true } }));
            return true; // Game is over
        }
    }
    
    if (gameState.isInversusMode) {
        if (gameState.players['player-1'].hearts <= 0) {
            showGameOver("Você foi derrotado...", "Fim de Jogo!");
            return true;
        }
        if (gameState.players['player-2'].hearts <= 0) {
            showInversusVictoryAnimation();
            grantAchievement('inversus_win');
            return true;
        }
    }

    const winningPlayers = Object.values(gameState.players).filter(p => p.position >= config.WINNING_POSITION);
    if (winningPlayers.length > 0) {
        if (gameState.isStoryMode) {
            const playerWon = winningPlayers.some(p => p.id === 'player-1');
            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: gameState.currentStoryBattle, won: playerWon } }));
        } else {
            const winnerNames = winningPlayers.map(p => p.name).join(' e ');
            showGameOver(`${winnerNames} venceu o jogo!`);
        }
        return true;
    }
    return false;
}

export function updateLiveScoresAndWinningStatus() {
    const { gameState } = getState();
    if (!gameState) return;
    
    let scores = {};
    let highestScore = -Infinity, lowestScore = Infinity;

    Object.values(gameState.players).forEach(p => {
        let score = p.playedCards.value.reduce((sum, card) => sum + card.value, 0);
        const restoValue = p.resto ? p.resto.value : 0;
        
        if (p.effects.score === 'Mais') score += restoValue;
        if (p.effects.score === 'Menos') score -= restoValue;
        if (p.effects.score === 'NECRO X') score += 10;
        if (p.effects.score === 'NECRO X Invertido') score -= 10;

        scores[p.id] = score;
        p.liveScore = score; // Update live score on player object
        if (!p.isEliminated) {
            highestScore = Math.max(highestScore, score);
            lowestScore = Math.min(lowestScore, score);
        }
    });

    if (gameState.gameMode === 'duo') {
        const teamScores = calculateTeamScores(scores);
        const isTeamAWinner = teamScores.teamA > teamScores.teamB;
        const isTeamBWinner = teamScores.teamB > teamScores.teamA;
        
        config.TEAM_A.forEach(id => {
            if (gameState.players[id]) gameState.players[id].status = isTeamAWinner ? 'winning' : (isTeamBWinner ? 'losing' : 'neutral');
        });
        config.TEAM_B.forEach(id => {
            if (gameState.players[id]) gameState.players[id].status = isTeamBWinner ? 'winning' : (isTeamAWinner ? 'losing' : 'neutral');
        });

    } else {
        Object.values(gameState.players).forEach(p => {
            if (p.isEliminated) {
                p.status = 'neutral';
                return;
            }
            if (scores[p.id] === highestScore && highestScore > lowestScore) {
                p.status = 'winning';
            } else if (scores[p.id] === lowestScore && highestScore > lowestScore) {
                p.status = 'losing';
            } else {
                p.status = 'neutral';
            }
        });
    }

    // Update side score boxes dynamically
    if (dom.leftScoreBox && dom.rightScoreBox && !gameState.isInversusMode) {
        // Player 1 is always on the left
        const p1Score = scores['player-1'] || 0;
        dom.leftScoreBox.className = 'side-score-box player-1-score';
        dom.leftScoreValue.textContent = p1Score;
        
        // Find the leading opponent for the right box
        const opponentIds = gameState.playerIdsInGame.filter(id => id !== 'player-1' && !gameState.players[id].isEliminated);
        
        if (gameState.gameMode === 'duo') {
            const teamScores = calculateTeamScores(scores);
            dom.leftScoreBox.className = 'side-score-box team-a-score';
            dom.rightScoreBox.className = 'side-score-box team-b-score';
            dom.leftScoreValue.textContent = teamScores.teamA;
            dom.rightScoreValue.textContent = teamScores.teamB;
        } else if (opponentIds.length > 0) {
            let leadingOpponentId = opponentIds[0];
            opponentIds.forEach(id => {
                if (scores[id] > scores[leadingOpponentId]) {
                    leadingOpponentId = id;
                }
            });
            
            const leadingOpponentScore = scores[leadingOpponentId] || 0;
            const pIdNum = parseInt(leadingOpponentId.split('-')[1]);
            dom.rightScoreBox.className = `side-score-box player-${pIdNum}-score`;
            dom.rightScoreValue.textContent = leadingOpponentScore;
            dom.rightScoreBox.classList.remove('hidden');
        } else {
            // Hide opponent score if there are no opponents (e.g., after elimination)
            dom.rightScoreBox.classList.add('hidden');
        }
    }
}

export function setupPvpRooms() {
    const rooms = Array.from({ length: 12 }, (_, i) => {
        const roomId = i + 1;
        const isSpecialRoom = roomId === 12;
        return {
            id: roomId,
            players: isSpecialRoom ? 1 : 4, // Room 12 has 1 player, others are full
            mode: ['1 vs 1', '1 vs 2', '2 vs 2'][Math.floor(Math.random() * 3)],
            password: isSpecialRoom ? 'Final' : null
        };
    });
    updateState('pvpRooms', rooms);
}

/**
 * Restores the game state from a pre-challenge snapshot.
 */
export function resumeGameFromSnapshot() {
    const snapshot = getState().preChallengeGameStateSnapshot;
    if (!snapshot) {
        console.error("Não foi possível restaurar o jogo: nenhum snapshot encontrado.");
        showSplashScreen();
        return;
    }

    // Restore the main game state
    updateState('gameState', snapshot);
    updateState('preChallengeGameStateSnapshot', null); // Clear the snapshot after using it

    const { gameState, gameTimerInterval } = getState();
    if (gameTimerInterval) clearInterval(gameTimerInterval);
    
    // Restore timer state
    const elapsedSeconds = snapshot.elapsedSeconds || 0;
    const newStartTime = Date.now() - (elapsedSeconds * 1000);
    updateState('gameStartTime', newStartTime);
    updateGameTimer();
    updateState('gameTimerInterval', setInterval(updateGameTimer, 1000));
    
    // BUG FIX: Hide the game over modal before restoring the game screen
    dom.gameOverModal.classList.add('hidden');
    
    dom.appContainerEl.classList.remove('hidden');
    dom.debugButton.classList.remove('hidden');

    // Re-create the player area divs to ensure clean state
    const player1Container = document.getElementById('player-1-area-container');
    const opponentsContainer = document.getElementById('opponent-zones-container');
    const createPlayerAreaHTML = (id) => `<div class="player-area" id="player-area-${id}"></div>`;
    player1Container.innerHTML = createPlayerAreaHTML('player-1');
    opponentsContainer.innerHTML = gameState.playerIdsInGame.filter(id => id !== 'player-1').map(id => createPlayerAreaHTML(id)).join('');

    renderAll();
    updateLog("Retornando ao jogo anterior...");
}