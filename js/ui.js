





import * as dom from './dom.js';
import * as config from './config.js';
import { getState, updateState } from './state.js';
import { updateLiveScoresAndWinningStatus } from './game.js';
import { initializeFloatingItemsAnimation } from './animations.js';
import { stopStoryMusic, updateMusic, initializeMusic } from './sound.js';
import { checkForSavedGame } from './save-load.js';
import * as achievements from './achievements.js';

/**
 * Gets the image URL for a given card.
 * @param {object} card - The card object.
 * @param {boolean} isHidden - Whether the card should be rendered face-down.
 * @returns {string} The URL of the card image.
 */
export const getCardImageUrl = (card, isHidden) => {
    if (isHidden) {
        return card.type === 'value' ? 'verso_valor.png' : 'verso_efeito.png';
    }
    if (card.name === 'NECRO X') {
        return 'cartanecroverso.png';
    }
    if (card.name === 'Carta da Versatrix') {
        return 'cartaversatrix.png';
    }
    const cardNameSanitized = card.name.toString().toLowerCase().replace(/\s/g, '');
    return `frente_${cardNameSanitized}.png`;
};

/**
 * Creates the HTML for a single card.
 * @param {object} card - The card object to render.
 * @param {string} context - The context in which the card is being rendered (e.g., 'player-hand', 'play-zone').
 * @param {string} playerId - The ID of the player associated with the card.
 * @returns {string} The HTML string for the card.
 */
export const renderCard = (card, context, playerId) => {
    const { gameState } = getState();
    const isHumanPlayer = playerId === 'player-1';
    const classList = ['card', card.type];
    const isHidden = context === 'ai-hand' && !gameState.revealedHands.includes(playerId) && !(gameState.isXaelChallenge && playerId !== 'player-1');
    
    let isCardDisabled = false;
    if (playerId && context === 'player-hand') {
        const player = gameState.players[playerId];
        if (player.isHuman && card.type === 'value') {
            const valueCardsInHandCount = player.hand.filter(c => c.type === 'value').length;
            if (valueCardsInHandCount <= 1 || player.playedValueCardThisTurn) {
                isCardDisabled = true;
            }
        }
        if(gameState.tutorialEffectCardsLocked && card.type === 'effect'){
             isCardDisabled = true;
        }
    }

    if (isHumanPlayer && context === 'player-hand' && gameState.selectedCard?.id === card.id) classList.push('selected');
    if (isCardDisabled) classList.push('disabled');
    if (context === 'modal') classList.push('modal-card');
    
    if (card.name === 'Reversus Total') {
        classList.push('reversus-total-card');
        if (playerId === 'player-1') {
            classList.push('reversus-total-glow');
        }
    }
    
    if (card.isLocked) {
        classList.push('locked');
    }
    
    if (context === 'play-zone' && card.casterId) {
        const caster = gameState.players[card.casterId];
        if (caster && caster.aiType === 'necroverso') {
            classList.push('necro-glow');
        }
    }
    
    const isCardObscuredByContravox = isHumanPlayer && context === 'player-hand' && gameState.player1CardsObscured;
    
    let cardTitle = '';
    if (isCardObscuredByContravox && card.type === 'effect') {
        cardTitle = 'title="Não é possível saber qual efeito será aplicado..."';
    }

    let cardStyle;
    if (isCardObscuredByContravox) {
        cardStyle = `style="background-image: url('cartacontravox.png');"`;
    } else {
        cardStyle = `style="background-image: url('${getCardImageUrl(card, isHidden)}');"`;
    }
    
    const maximizeButtonHTML = !isHidden && !isCardObscuredByContravox ? '<div class="card-maximize-button" title="Ver carta"></div>' : '';

    return `<div class="${classList.join(' ')}" data-card-id="${card.id}" ${cardTitle} ${isCardDisabled ? 'aria-disabled="true"' : ''} ${cardStyle}>
                ${maximizeButtonHTML}
            </div>`;
};


/**
 * Renders a single player's entire area, including header, hand, and play zone.
 * @param {object} player - The player object to render.
 */
export const renderPlayerArea = (player) => {
    const playerEl = document.getElementById(`player-area-${player.id}`);
    if (!playerEl) return;
    
    const { gameState } = getState();
    const pIdNum = parseInt(player.id.split('-')[1]);

    // Apply classes for styling
    playerEl.className = 'player-area'; // Reset classes
    if (gameState.isInversusMode && player.aiType === 'inversus') {
        playerEl.classList.add('inversus-bg');
    } else if (player.aiType === 'xael') {
        playerEl.classList.add('xael-portrait-bg');
    } else if (player.aiType === 'necroverso_tutorial') {
        playerEl.classList.add('player-area-necro-tutorial');
    } else if (player.aiType === 'necroverso_final') {
        playerEl.classList.add('player-area-necro-final');
    }
    else {
        playerEl.classList.add(`p${pIdNum}-bg`);
    }

    if (player.aiType === 'contravox') playerEl.classList.add('contravox-glow');
    if (player.aiType === 'versatrix') playerEl.classList.add('versatrix-glow');
    if (player.aiType === 'reversum') playerEl.classList.add('reversum-glow');

    if(player.isEliminated) playerEl.classList.add('eliminated');

    const isRevealed = gameState.revealedHands.includes(player.id);
    const effectsList = [player.effects.score, player.effects.movement].filter(Boolean);
    const activeFieldEffects = gameState.activeFieldEffects.filter(fe => fe.appliesTo === player.id);
    let fieldEffectIndicatorHTML = '';
    let heartsHTML = '';
    let playerNameClass = `player-name player-1`; // Default
    let portraitHTML = '';
    let starCounterHTML = '';

    // Consolidated portrait logic
    const specialPortraits = {
        'necroverso_tutorial': { src: 'necroverso.png', class: '' },
        'contravox': { src: 'contravox.png', class: 'contravox-portrait' },
        'versatrix': { src: 'versatrix.png', class: '' },
        'reversum': { src: 'reversum.png', class: '' },
        'narrador': { src: 'narrador.png', class: 'effect-glitch' },
        'xael': { src: 'xaeldesafio.png', class: 'xael-glow' },
    };

    if (gameState.isInversusMode && player.aiType === 'inversus') {
        portraitHTML = `<img src="inversum1.png" id="inversus-character-portrait" class="inversus-character-portrait" alt="Inversus portrait">`;
    } else if (specialPortraits[player.aiType]) {
        const portraitInfo = specialPortraits[player.aiType];
        // Prevent showing the Versatrix portrait for player 1 if they somehow get it
        if (!(player.aiType === 'versatrix' && player.id === 'player-1')) {
            portraitHTML = `<img src="${portraitInfo.src}" class="player-area-character-portrait ${portraitInfo.class}" alt="${player.name} portrait">`;
        }
    }

    if (gameState.isInversusMode && player.aiType === 'inversus') {
        playerNameClass = 'player-name player-2 inversus-name-glow';
    } else if (player.name === 'Rei Necroverso') {
        if (player.aiType === 'reversum') playerNameClass = 'player-name player-2';
        else if (player.aiType === 'contravox') playerNameClass = 'player-name player-3';
        else if (player.aiType === 'versatrix') playerNameClass = 'player-name player-4';
    } else if (player.aiType && player.aiType.includes('necroverso')) {
        playerNameClass = 'player-name necro';
        if(player.aiType === 'necroverso_final') {
             playerNameClass += ' final-boss-glow';
        }
    } else if (player.aiType === 'xael') {
        playerNameClass = 'player-name xael';
    } else {
        playerNameClass = `player-name player-${pIdNum}`;
    }


    if (activeFieldEffects.length > 0) {
        const effect = activeFieldEffects[0];
        const effectColor = effect.type === 'positive' ? 'var(--accent-blue)' : 'var(--accent-red)';
        fieldEffectIndicatorHTML = `
            <div class="field-effect-indicator" data-player-id="${player.id}" title="Ver Efeito de Campo">
                <span style="font-weight: 700; color: ${effectColor}; font-size: 0.85rem;">Efeito de Campo</span>
                <div class="field-effect-square" style="background-color: ${effectColor};"></div>
            </div>
        `;
    }

    if (gameState.isInversusMode) {
        const heartIcon = player.id === 'player-1' ? '❤️' : '🖤';
        const heartsText = heartIcon.repeat(player.hearts || 0);
        heartsHTML = `<div class="inversus-hearts-container" title="Corações">${heartsText}</div>`;
    }

    if (gameState.isXaelChallenge) {
        starCounterHTML = `<div class="player-star-counter" title="Estrelas">⭐ ${player.stars || 0}</div>`;
    }
    
    const positionLabel = (gameState.isInversusMode || gameState.isXaelChallenge) ? 'Vitórias' : 'Casa';
    const positionValue = player.position;
    const effectsHTML = effectsList.length > 0 ? effectsList.map(e => `<span>${e}</span>`).join(' ') : 'Nenhum';
    
    // Logic for Contravox score display
    const scoreDisplay = player.liveScore;

    const statsHTML = `
        <div class="player-stats">
            <span class="stat-item">Pontos: <strong>${scoreDisplay}</strong></span>
            ${!(gameState.isInversusMode || gameState.isXaelChallenge) ? `<span class="stat-item">${positionLabel}: <strong>${positionValue}</strong></span>` : ''}
            <span class="stat-item">Resto: <strong>${player.resto ? player.resto.name : 'N/A'}</strong></span>
            <span class="stat-item">Efeitos: <strong>${effectsHTML}</strong></span>
        </div>
    `;

    let statusText = '';
    if (player.status === 'winning') statusText = 'Vencendo';
    if (player.status === 'losing') statusText = 'Perdendo';
    
    const headerHTML = `
        <div class="player-header">
            <div class="human-header-top">
                <div class="player-name-container">
                    <span class="${playerNameClass}">${player.name}</span>
                    ${heartsHTML}
                    ${starCounterHTML}
                    ${isRevealed ? '<div class="revealed-icon" title="Mão revelada"></div>' : ''}
                    ${fieldEffectIndicatorHTML}
                </div>
                <div class="player-status-indicator ${player.status}">${statusText}</div>
            </div>
            ${statsHTML}
        </div>
    `;
    
    const handContext = (player.isHuman || isRevealed || (gameState.isXaelChallenge && !player.isHuman)) ? 'player-hand' : 'ai-hand';
    
    const sortedHand = [...player.hand].sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === 'value' ? -1 : 1;
    });
    const handHTML = sortedHand.map(card => renderCard(card, handContext, player.id)).join('');
    
    const renderSlot = (card, label) => {
        const cardHTML = card ? renderCard(card, 'play-zone', player.id) : '';
        return `<div class="play-zone-slot" data-label="${label}">${cardHTML}</div>`;
    };
    
    const valueCard1 = player.playedCards.value[0];
    const valueCard2 = player.playedCards.value[1];
    const scoreEffectCard = player.playedCards.effect.find(c => ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido', 'Carta da Versatrix', 'Estrela Subente'].includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'score') || (c.name === 'Reversus Total' && c.reversedEffectType === 'score'));
    const moveEffectCard = player.playedCards.effect.find(c => ['Sobe', 'Desce', 'Pula'].includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'movement') || (c.name === 'Reversus Total' && c.reversedEffectType === 'movement'));
    const reversusTotalCard = player.playedCards.effect.find(c => c.name === 'Reversus Total' && !c.reversedEffectType && !c.isLocked);


    const playZoneHTML = `
        <div class="play-zone" id="play-zone-${player.id}">
            ${renderSlot(valueCard1, 'Valor 1')}
            ${renderSlot(valueCard2, 'Valor 2')}
            ${renderSlot(scoreEffectCard, 'Pontuação')}
            ${renderSlot(moveEffectCard, 'Movimento')}
            ${renderSlot(reversusTotalCard, 'Reversus T.')}
        </div>
    `;

    const areaContent = `
        ${headerHTML}
        ${playZoneHTML}
        <div class="player-hand" id="hand-${player.id}">${handHTML}</div>
        ${portraitHTML}
    `;
    
    playerEl.innerHTML = areaContent;
};

/**
 * Renders all player areas on the screen.
 */
const renderAllPlayerAreas = () => {
    const { gameState } = getState();
    if (!gameState || !gameState.players) return;
    Object.values(gameState.players).forEach(renderPlayerArea);
};

/**
 * Renders the game board, including paths, spaces, and player pawns.
 */
export const renderBoard = () => {
    const { gameState } = getState();
    if (!gameState) return;
    dom.boardEl.innerHTML = '';
    const playerIds = gameState.playerIdsInGame;

    gameState.boardPaths.forEach(path => {
        const pathEl = document.createElement('div');
        pathEl.className = 'player-path';
        pathEl.style.transform = `translateX(-50%) rotate(${path.id * (360 / config.NUM_PATHS)}deg)`;

        path.spaces.forEach(space => {
            const spaceEl = document.createElement('div');
            const classList = ['board-space', `space-${space.color}`];
            if (space.isUsed) classList.push('used');
            spaceEl.className = classList.join(' ');
            
            if (space.color === 'star') {
                spaceEl.innerHTML = '<span class="star-icon">⭐</span>';
            } else {
                 spaceEl.textContent = space.id.toString();
            }

            const pawnContainer = document.createElement('div');
            pawnContainer.className = 'pawn-container';
            spaceEl.appendChild(pawnContainer);
            pathEl.appendChild(spaceEl);
        });
        dom.boardEl.appendChild(pathEl);
    });

    if (gameState.isInversusMode) {
        return; // No pawns in Inversus mode
    }

    // Render pawns in the center (position 10)
    if (!gameState.isFinalBoss && !gameState.isXaelChallenge) {
        const centerPawnsContainer = document.createElement('div');
        centerPawnsContainer.className = 'board-center-pawns';
        const pawnsInCenter = playerIds
            .map(id => gameState.players[id])
            .filter(p => p.position === config.WINNING_POSITION && !p.isEliminated);

        pawnsInCenter.forEach(player => {
            const pawnEl = document.createElement('div');
            const pawnClassList = ['pawn'];
            if (player.aiType && player.aiType.includes('necroverso')) {
                pawnClassList.push('necro');
            } else if (player.aiType === 'xael') {
                pawnClassList.push('xael');
            } else {
                const pIdNum = parseInt(player.id.split('-')[1]);
                pawnClassList.push(`player-${pIdNum}`);
            }
            pawnEl.className = pawnClassList.join(' ');
            pawnEl.title = player.name;
            centerPawnsContainer.appendChild(pawnEl);
        });
        dom.boardEl.appendChild(centerPawnsContainer);
    }


    // Render pawns on the paths
    playerIds.forEach(playerId => {
        const player = gameState.players[playerId];
        if (player.pathId === -1 || player.isEliminated || player.position >= config.WINNING_POSITION) return;

        if (player.position > 0 && player.position < config.WINNING_POSITION) {
            const pathEl = dom.boardEl.children[player.pathId];
            if (!pathEl) return;
            
            const spaceIndex = player.position - 1;
            const spaceEl = pathEl.children[spaceIndex];
            
            if (spaceEl) {
                const pawnContainer = spaceEl.querySelector('.pawn-container');
                const pawnEl = document.createElement('div');
                const pawnClassList = ['pawn'];
                 if (player.aiType && player.aiType.includes('necroverso')) {
                    pawnClassList.push('necro');
                } else if (player.aiType === 'xael') {
                    pawnClassList.push('xael');
                } else {
                    const pIdNum = parseInt(player.id.split('-')[1]);
                    pawnClassList.push(`player-${pIdNum}`);
                }
                pawnEl.className = pawnClassList.join(' ');
                pawnEl.title = player.name;
                if(pawnContainer) pawnContainer.appendChild(pawnEl);
            }
        }
    });
};

/**
 * Updates the visual indicator for the current player's turn.
 */
export const updateTurnIndicator = () => {
    const { gameState } = getState();
    if (!gameState || !gameState.players) {
        dom.turnIndicatorEl.textContent = 'Carregando...';
        return;
    }

    const player = gameState.players[gameState.currentPlayer];
    let turnText;
    
    if(player.isHuman){
        turnText = `Sua vez`;
    } else {
        turnText = `Vez de: ${player.name}`;
    }

    switch (gameState.gamePhase) {
        case 'paused': turnText = `${player.name} está pensando...`; break;
        case 'targeting': turnText = 'Escolha um alvo para o efeito...'; break;
        case 'reversus_targeting': turnText = `Escolha o tipo de efeito para reverter em ${gameState.players[gameState.reversusTarget.targetPlayerId].name}...`; break;
        case 'pula_casting': turnText = `Escolha um caminho para ${gameState.players[gameState.pulaTarget.targetPlayerId].name} pular...`; break;
        case 'field_effect_targeting': turnText = 'Escolha um alvo para o Efeito de Campo...'; break;
        case 'path_selection': turnText = 'Escolhendo caminhos...'; break;
        case 'resolution': turnText = 'Resolvendo a rodada...'; break;
        case 'game_over': turnText = 'Fim de Jogo!'; break;
    }

    dom.turnIndicatorEl.textContent = turnText;
    
    Object.values(gameState.players).forEach(p => {
        const playerArea = document.getElementById(`player-area-${p.id}`);
        if(playerArea) playerArea.classList.toggle('active', p.id === gameState.currentPlayer && gameState.gamePhase === 'playing');
    });

    const isHumanTurn = gameState.currentPlayer === 'player-1' && gameState.gamePhase === 'playing';
    const player1 = gameState.players['player-1'];
    const valueCardsInHandCount = player1 ? player1.hand.filter(c => c.type === 'value').length : 0;
    
    dom.playButton.disabled = !isHumanTurn || !gameState.selectedCard;
    dom.endTurnButton.disabled = !isHumanTurn || (valueCardsInHandCount >= 2 && !player1.playedValueCardThisTurn);
};

/**
 * Flashes a "Sua Vez" indicator on the screen.
 */
export const showTurnIndicator = async () => {
    return new Promise(resolve => {
        const turnAnnounceEl = dom.turnAnnounceModal;
        const turnContentEl = turnAnnounceEl.querySelector('.turn-announce-content');
        if (!turnContentEl) {
            resolve();
            return;
        }

        turnAnnounceEl.classList.remove('hidden');
        
        // Remove animation class to be able to re-trigger it
        turnContentEl.style.animation = 'none';
        // force reflow
        void turnContentEl.offsetWidth;
        // re-add animation
        turnContentEl.style.animation = 'fade-in-out 1.5s forwards';

        setTimeout(() => {
            turnAnnounceEl.classList.add('hidden');
            resolve();
        }, 1500);
    });
};

export const showRoundSummaryModal = (winners, scores) => {
    return new Promise(resolve => {
        const { gameState } = getState();
        
        dom.roundSummaryTitle.textContent = `Fim da Rodada ${gameState.turn}`;
        
        let winnerText;
        if (winners.length === 0) {
            winnerText = "Empate! Ninguém avança.";
        } else if (winners.length === 1) {
            winnerText = `Vencedor: ${gameState.players[winners[0]].name}`;
        } else {
            winnerText = `Vencedores: ${winners.map(id => gameState.players[id].name).join(', ')}`;
        }
        dom.roundSummaryWinnerText.textContent = winnerText;

        dom.roundSummaryScoresEl.innerHTML = gameState.playerIdsInGame.map(id => {
            const player = gameState.players[id];
            const isWinner = winners.includes(id);
            const pIdNum = parseInt(id.split('-')[1]);
            let playerNameClasses = `summary-player-name player-name player-${pIdNum}`;
            if (player.aiType === 'xael') {
                playerNameClasses = `summary-player-name player-name xael`;
            }

            return `
                <div class="summary-player-score ${isWinner ? 'is-winner' : ''}">
                    <span class="${playerNameClasses}">${player.name}</span>
                    <span class="summary-player-final-score">${scores[id]}</span>
                </div>
            `;
        }).join('');
        
        dom.roundSummaryModal.classList.remove('hidden');

        dom.nextRoundButton.onclick = () => {
            dom.roundSummaryModal.classList.add('hidden');
            resolve();
        };
    });
};

/**
 * Displays the game over modal.
 * @param {string} message - The message to display.
 * @param {string} [title="Fim de Jogo!"] - The title of the modal.
 * @param {boolean} [showRestart=true] - Whether to show the restart button.
 */
export const showGameOver = (message, title = "Fim de Jogo!", showRestart = true) => {
    const { gameTimerInterval, gameState } = getState();
    if(gameTimerInterval) clearInterval(gameTimerInterval);
    updateState('gameTimerInterval', null);

    if (gameState?.isStoryMode && document.body.dataset.storyContinuation === 'true') {
        return;
    }
    
    if (gameState?.isXaelChallenge) {
        dom.cosmicGlowOverlay.classList.add('hidden');
    }

    dom.gameOverTitle.textContent = title;
    dom.gameOverMessage.textContent = message;
    dom.restartButton.classList.toggle('hidden', !showRestart);
    dom.gameOverModal.classList.remove('hidden');
    dom.debugButton.classList.add('hidden');
    dom.xaelStarPowerButton.classList.add('hidden');
};

/**
 * Initializes and displays the splash screen.
 */
export const showSplashScreen = () => {
    const { versatrixCardInterval, inversusAnimationInterval, glitchInterval } = getState();
    if (versatrixCardInterval) {
        clearInterval(versatrixCardInterval);
        updateState('versatrixCardInterval', null);
    }
    if (inversusAnimationInterval) {
        clearInterval(inversusAnimationInterval);
        updateState('inversusAnimationInterval', null);
    }
    if (glitchInterval) {
        clearInterval(glitchInterval);
        updateState('glitchInterval', null);
    }


    dom.appContainerEl.classList.add('hidden');
    dom.debugButton.classList.add('hidden');
    dom.xaelStarPowerButton.classList.add('hidden');
    dom.gameOverModal.classList.add('hidden');
    dom.gameSetupModal.classList.add('hidden');
    dom.rulesModal.classList.add('hidden');
    dom.creditsModal.classList.add('hidden');
    dom.achievementsModal.classList.add('hidden');
    dom.pvpRoomListModal.classList.add('hidden');
    dom.storyModeModalEl.classList.add('hidden');
    dom.exitGameConfirmModal.classList.add('hidden');
    dom.saveGameConfirmModal.classList.add('hidden');
    dom.gameMenuModal.classList.add('hidden');
    if (dom.leftScoreBox) dom.leftScoreBox.classList.add('hidden');
    if (dom.rightScoreBox) dom.rightScoreBox.classList.add('hidden');
    dom.cosmicGlowOverlay.classList.add('hidden');

    initializeFloatingItemsAnimation(dom.splashAnimationContainerEl);
    dom.splashScreenEl.classList.remove('hidden');

    // Set menu music to 'tela.ogg'
    dom.nextTrackButton.disabled = false;
    dom.musicPlayer.loop = true;
    const telaTrackIndex = config.MUSIC_TRACKS.indexOf('tela.ogg');
    if (telaTrackIndex !== -1) {
        updateState('currentTrackIndex', telaTrackIndex);
        dom.musicPlayer.src = config.MUSIC_TRACKS[telaTrackIndex];
    }
    updateMusic();

    checkForSavedGame();
    // Re-check for special features now that we're on the splash screen
    achievements.checkAndShowSpecialFeatures();
};

/**
 * Renders all UI components based on the current game state.
 */
export const renderAll = () => {
    const { gameState } = getState();
    if (!gameState) {
        showSplashScreen();
        return;
    }
    renderBoard();
    updateLiveScoresAndWinningStatus();
    renderAllPlayerAreas();
    updateTurnIndicator();
    updateXaelStarPowerUI();

    const playButton = dom.playButton;
    if (playButton) {
        if (!gameState.selectedCard) {
            playButton.disabled = true;
        } else {
            const player = gameState.players['player-1'];
            const card = gameState.selectedCard;
            if (card.type === 'value') {
                const valueCardsInHandCount = player.hand.filter(c => c.type === 'value').length;
                playButton.disabled = valueCardsInHandCount <= 1 || player.playedValueCardThisTurn;
            } else {
                playButton.disabled = false;
            }
        }
    }
};


export const showGameSetupModal = () => dom.gameSetupModal.classList.remove('hidden');

export const renderPvpRooms = () => {
    const { pvpRooms } = getState();
    
    dom.pvpRoomGridEl.innerHTML = pvpRooms.map(room => {
        const isSpecialRoom = room.id === 12;
        let roomClass = `color-${(room.id % 4) + 1}`;
        if (isSpecialRoom) roomClass = 'special-room';
        
        const isFull = room.players >= 4;
        const roomStatus = isFull ? "Lotada" : `${room.players}/4`;
        const buttonText = isFull ? 'Lotada' : 'Entrar';
        const buttonDisabled = isFull;
        
        return `
        <div class="room-card ${roomClass}">
            <div>
                <h3>${isSpecialRoom ? "Sala Final" : `Sala ${room.id}`}</h3>
                <p>Modo: ${room.mode}</p>
                <p>Jogadores: ${roomStatus}</p>
            </div>
            <button class="control-button pvp-enter-room-button" data-room-id="${room.id}" ${buttonDisabled ? 'disabled' : ''}>
                ${buttonText}
            </button>
        </div>`;
    }).join('');
};

export const updateLobbyUi = (roomId) => {
    const { pvpRooms } = getState();
    const room = pvpRooms.find(r => r.id === roomId);
    if (!room) return;
    
    const isRoomMaster = true; // For now, player is always master
    dom.lobbyGameModeEl.disabled = !isRoomMaster;
    
    const mode = dom.lobbyGameModeEl.value;
    let p2Visible, p3Visible, p4Visible;
    let p2Label = "Oponente 1 (I.A.):", p3Label = "Oponente 2 (I.A.):";

    switch(mode) {
        case 'solo-2p': [p2Visible, p3Visible, p4Visible] = [true, false, false]; break;
        case 'solo-3p': [p2Visible, p3Visible, p4Visible] = [true, true, false]; break;
        case 'solo-4p': [p2Visible, p3Visible, p4Visible] = [true, true, true]; break;
        case 'duo': 
            [p2Visible, p3Visible, p4Visible] = [true, true, true];
            p2Label = "Oponente 1 (I.A.):";
            p3Label = "Aliado (I.A.):";
            break;
    }

    document.getElementById('lobby-ai-p2-container').classList.toggle('hidden', !p2Visible);
    document.getElementById('lobby-ai-p3-container').classList.toggle('hidden', !p3Visible);
    document.getElementById('lobby-ai-p4-container').classList.toggle('hidden', !p4Visible);
    
    document.getElementById('lobby-ai-p2-label').textContent = p2Label;
    document.getElementById('lobby-ai-p3-label').textContent = p3Label;
    
    const isSpecialRoom = roomId === 12;
    ['lobby-ai-p2', 'lobby-ai-p3', 'lobby-ai-p4'].forEach(selectId => {
        const selectEl = document.getElementById(selectId);
        if (selectEl) {
            for (const option of selectEl.options) {
                const isSpecialAI = ['contravox', 'versatrix', 'reversum', 'necroverso', 'necroverso_final', 'xael', 'narrador', 'inversus'].includes(option.value);
                if (isSpecialAI) {
                    option.disabled = !isSpecialRoom;
                    if (!isSpecialRoom && selectEl.value === option.value) {
                        selectEl.value = 'default';
                    }
                }
            }
        }
    });

    document.getElementById('lobby-ai-config').classList.remove('hidden');
};

export const addLobbyChatMessage = (sender, message) => {
    const messageEl = document.createElement('div');
    messageEl.innerHTML = `<strong>${sender}:</strong> `;
    const textNode = document.createTextNode(message);
    messageEl.appendChild(textNode);
    dom.lobbyChatHistoryEl.appendChild(messageEl);
    dom.lobbyChatHistoryEl.scrollTop = dom.lobbyChatHistoryEl.scrollHeight;
};

export function showAchievementNotification(achievement, customText = '') {
    const toast = dom.achievementUnlockedToast;
    const toastText = dom.toastText;
    if (!toast || !toastText) return;

    toastText.textContent = customText || `Conquista: ${achievement.name}`;
    toast.className = 'achievement-unlocked-toast'; // Reset class
    
    // Force reflow to restart animation
    void toast.offsetWidth;

    toast.classList.add('show');
}

export const updateXaelStarPowerUI = () => {
    const { gameState } = getState();
    if (!gameState || !dom.xaelStarPowerButton) return;
    
    const player = gameState.players['player-1'];
    
    if (player && player.hasXaelStarPower) {
        dom.xaelStarPowerButton.classList.remove('hidden');
        const isReady = player.xaelStarPowerCooldown === 0;
        dom.xaelStarPowerButton.classList.toggle('cooldown', !isReady);
        dom.xaelStarPowerButton.disabled = !isReady;
        dom.xaelStarPowerButton.title = isReady ? 'Poder Estelar do Xael (Revela mãos)' : `Poder Estelar (Recarregando: ${player.xaelStarPowerCooldown} rodadas)`;
    } else {
        dom.xaelStarPowerButton.classList.add('hidden');
    }
};