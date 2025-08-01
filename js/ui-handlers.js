



import * as dom from './dom.js';
import { getState, updateState } from './state.js';
import * as game from './game.js';
import * as ui from './ui.js';
import * as sound from './sound.js';
import * as story from './story.js';
import * as saveLoad from './save-load.js';
import * as achievements from './achievements.js';
import { updateLog } from './utils.js';
import * as config from './config.js';
import { shatterImage } from './animations.js';

function handleCardClick(cardElement) {
    const { gameState } = getState();
    const cardId = parseFloat(cardElement.dataset.cardId);
    if (!gameState || gameState.currentPlayer !== 'player-1' || gameState.gamePhase !== 'playing' || isNaN(cardId)) {
        return;
    }

    const player = gameState.players['player-1'];
    const card = player.hand.find(c => c.id === cardId);

    if (card) {
        // Prevent selecting a second value card if one has already been played
        if (card.type === 'value' && player.playedValueCardThisTurn) {
            return;
        }
        if(gameState.tutorialEffectCardsLocked && card.type === 'effect') return;
        gameState.selectedCard = (gameState.selectedCard?.id === cardId) ? null : card;
        ui.renderAll();
    }
}

async function handlePlayerTargetSelection(targetId) {
    const { gameState } = getState();
    
    if (gameState.gamePhase === 'field_effect_targeting') {
        const { fieldEffectTargetingInfo } = getState();
        if(fieldEffectTargetingInfo?.resolve) {
            fieldEffectTargetingInfo.resolve(targetId);
        }
        dom.targetModal.classList.add('hidden');
        updateState('fieldEffectTargetingInfo', null);
        gameState.gamePhase = 'playing';
        ui.renderAll();
        return;
    }
    
    if (getState().reversusTotalIndividualFlow) {
        dom.targetModal.classList.add('hidden');
        gameState.reversusTarget = { card: gameState.selectedCard, targetPlayerId: targetId };
        gameState.gamePhase = 'reversus_targeting';
        dom.reversusIndividualEffectChoiceModal.classList.remove('hidden');
        ui.updateTurnIndicator();
        return;
    }


    if (!gameState.selectedCard) return;
    const card = gameState.selectedCard;
    dom.targetModal.classList.add('hidden');

    if (card.name === 'Reversus') {
        gameState.reversusTarget = { card, targetPlayerId: targetId };
        gameState.gamePhase = 'reversus_targeting';
        dom.reversusTargetModal.classList.remove('hidden');
        ui.updateTurnIndicator();
    } else if (card.name === 'Pula') {
        const availablePaths = gameState.boardPaths.filter(p => !Object.values(gameState.players).map(pl => pl.pathId).includes(p.id));
        if (availablePaths.length === 0) {
            alert("Não há caminhos vazios para pular! A jogada foi cancelada.");
            updateLog("Tentativa de jogar 'Pula' falhou: Nenhum caminho vazio disponível.");
            gameState.gamePhase = 'playing';
            gameState.selectedCard = null;
            ui.renderAll();
            return;
        }
        gameState.pulaTarget = { card, targetPlayerId: targetId };
        handlePulaCasterChoice(card, targetId);
    } else {
        gameState.gamePhase = 'playing';
        await game.playCard(gameState.players['player-1'], card, targetId);
    }
}

function handlePulaCasterChoice(card, targetId) {
    const { gameState } = getState();
    gameState.gamePhase = 'pula_casting';
    const target = gameState.players[targetId];

    dom.pulaModalTitle.textContent = `Jogar 'Pula' em ${target.name}`;
    dom.pulaModalText.textContent = `Escolha um caminho vazio para ${target.name} pular:`;
    dom.pulaCancelButton.classList.remove('hidden');

    const occupiedPathIds = Object.values(gameState.players).map(player => player.pathId);
    
    dom.pulaPathButtonsEl.innerHTML = gameState.boardPaths.map(path => {
        const pathOccupant = Object.values(gameState.players).find(player => player.pathId === path.id);
        const isOccupied = !!pathOccupant;
        const isDisabled = isOccupied;
        return `<button class="control-button" data-path-id="${path.id}" ${isDisabled ? 'disabled' : ''}>Caminho ${path.id + 1} ${isOccupied ? `(Ocupado por ${pathOccupant.name})` : '(Vazio)'}</button>`
    }).join('');

    dom.pulaModal.classList.remove('hidden');
    ui.updateTurnIndicator();
}

async function handlePulaPathSelection(chosenPathId) {
    const { gameState } = getState();
    if (!gameState.pulaTarget) return;
    const { card, targetPlayerId } = gameState.pulaTarget;
    const target = gameState.players[targetPlayerId];
    target.targetPathForPula = chosenPathId;
    updateLog(`${gameState.players['player-1'].name} escolheu que ${target.name} pule para o caminho ${chosenPathId + 1}.`);
    
    dom.pulaModal.classList.add('hidden');
    gameState.gamePhase = 'playing';
    await game.playCard(gameState.players['player-1'], card, targetPlayerId);
}

export function initializeUiHandlers() {
    // --- Splash Screen ---
    dom.quickStartButton.addEventListener('click', () => {
        sound.initializeMusic();
        dom.splashScreenEl.classList.add('hidden');
        ui.showGameSetupModal();
    });

    dom.storyModeButton.addEventListener('click', story.startStoryMode);

    dom.inversusModeButton.addEventListener('click', () => {
        sound.initializeMusic();
        game.initializeGame('inversus', {
            numPlayers: 2,
            overrides: {
                'player-2': { name: 'Inversus', aiType: 'inversus' }
            }
        });
    });

    dom.pvpModeButton.addEventListener('click', () => {
        sound.initializeMusic();
        ui.renderPvpRooms();
        dom.splashScreenEl.classList.add('hidden');
        dom.pvpRoomListModal.classList.remove('hidden');
    });

    dom.instructionsButton.addEventListener('click', () => {
        sound.initializeMusic();
        dom.rulesModal.classList.remove('hidden');
    });

    dom.creditsButton.addEventListener('click', () => {
        sound.initializeMusic();
        dom.creditsModal.classList.remove('hidden');
    });

    dom.continueButton.addEventListener('click', () => {
        sound.initializeMusic();
        saveLoad.loadGameState();
    });

    dom.closeRulesButton.addEventListener('click', () => dom.rulesModal.classList.add('hidden'));
    dom.closeCreditsButton.addEventListener('click', () => dom.creditsModal.classList.add('hidden'));
    
    dom.splashAnimationContainerEl.addEventListener('click', (e) => {
        if (e.target.id === 'secret-versatrix-card') {
            e.stopPropagation();
            e.target.remove();
            
            const { versatrixCardInterval } = getState();
            if (versatrixCardInterval) {
                clearInterval(versatrixCardInterval);
                updateState('versatrixCardInterval', null);
            }
            
            achievements.grantAchievement('versatrix_card_collected');
            ui.showAchievementNotification(
                { name: 'Presente da Rainha!' }, 
                'Obteve a carta de Versatrix, ela espera que te ajude ;)'
            );
        }
    });

    if (dom.splashLogo) {
        dom.splashLogo.addEventListener('click', () => {
            if (dom.splashLogo.classList.contains('effect-glitch')) {
                sound.initializeMusic();
                game.initializeGame('solo', {
                    story: {
                        battle: 'narrador',
                        playerIds: ['player-1', 'player-2'],
                        overrides: { 'player-2': { name: 'Narrador', aiType: 'narrador' } }
                    }
                });
            }
        });
    }

    // --- Game Setup ---
    const setupGame = (numPlayers, mode = 'solo') => {
        game.initializeGame(mode, { numPlayers, overrides: {} });
    };
    dom.solo2pButton.addEventListener('click', () => setupGame(2));
    dom.solo3pButton.addEventListener('click', () => setupGame(3));
    dom.solo4pButton.addEventListener('click', () => setupGame(4));
    dom.duoModeButton.addEventListener('click', () => setupGame(4, 'duo'));
    dom.closeSetupButton.addEventListener('click', ui.showSplashScreen);
    
    // --- Global Game Actions ---
    dom.appContainerEl.addEventListener('click', (e) => {
        // Prioritize more specific targets first
        const cardZoom = e.target.closest('.card-maximize-button');
        const indicator = e.target.closest('.field-effect-indicator');
        const cardElement = e.target.closest('.card');

        if (cardZoom) {
            e.stopPropagation(); // Prevent card selection click
            const cardEl = cardZoom.closest('.card');
            const bgImage = cardEl.style.backgroundImage;
            if (bgImage) {
                // BUG FIX: Extract URL and set the src of the img element
                const imageUrlMatch = bgImage.match(/url\("?(.+?)"?\)/);
                if (imageUrlMatch && imageUrlMatch[1]) {
                    dom.cardViewerImageEl.src = imageUrlMatch[1];
                    dom.cardViewerModalEl.classList.remove('hidden');
                }
            }
        } else if (indicator && indicator.dataset.playerId) {
            const { gameState } = getState();
            const playerId = indicator.dataset.playerId;
            const effect = gameState.activeFieldEffects.find(fe => fe.appliesTo === playerId);
            if (effect) {
                dom.fieldEffectInfoTitle.textContent = `Efeito Ativo em ${gameState.players[playerId].name}`;
                dom.fieldEffectInfoName.textContent = effect.name;
                let description = config.POSITIVE_EFFECTS[effect.name] || config.NEGATIVE_EFFECTS[effect.name];
                if (!description && gameState.isXaelChallenge) {
                    const challengeEffects = { ...config.XAEL_CHALLENGE_EFFECTS.positive, ...config.XAEL_CHALLENGE_EFFECTS.negative };
                    description = challengeEffects[effect.name];
                }
                dom.fieldEffectInfoDescription.textContent = description;
                dom.fieldEffectInfoModal.classList.remove('hidden');
            }
        } else if (cardElement) {
            // This will now only run if the click wasn't on a zoom button or indicator
            handleCardClick(cardElement);
        }
    });

    dom.playButton.addEventListener('click', async () => {
        // Disable button immediately to prevent multiple clicks
        dom.playButton.disabled = true;

        const { gameState } = getState();
        const card = gameState.selectedCard;
        if (!card) return; // Should not happen as button is disabled, but good guard clause.

        if (card.name === 'Reversus Total') {
            dom.reversusTotalChoiceModal.classList.remove('hidden');
            // Re-enable button if user cancels the modal
            dom.playButton.disabled = false;
            return;
        }

        const effectNeedsTarget = ['Mais', 'Menos', 'Sobe', 'Desce', 'Pula', 'Reversus', 'Estrela Subente', 'Estrela Cadente', 'Roubo da Estrela', 'Doando uma Estrela'].includes(card.name);
        if (effectNeedsTarget) {
            dom.targetModal.classList.remove('hidden');
            dom.targetModalCardName.textContent = card.name;
            
            let targetablePlayers = gameState.playerIdsInGame;
            
            dom.targetPlayerButtonsEl.innerHTML = targetablePlayers.map(id => {
                const playerObj = gameState.players[id];
                const pIdNum = parseInt(id.split('-')[1]);
                return `<button class="control-button target-player-${pIdNum}" data-target-id="${id}">${playerObj.name}</button>`;
            }).join('');
        } else {
            await game.playCard(gameState.players['player-1'], card, 'player-1');
        }
    });
    
    dom.endTurnButton.addEventListener('click', game.advanceToNextPlayer);
    
    dom.restartButton.addEventListener('click', () => {
        const { gameState } = getState();
        if (gameState?.isXaelChallenge) {
            // The resumeGameFromSnapshot function now handles all the logic
            // for restoring the state and hiding the modal.
            game.resumeGameFromSnapshot();
        } else {
            // For all other game modes, simply return to the splash screen.
            ui.showSplashScreen();
        }
    });

    // --- Modal Handlers ---
    dom.targetPlayerButtonsEl.addEventListener('click', (e) => {
        if (e.target.dataset.targetId) {
            handlePlayerTargetSelection(e.target.dataset.targetId);
        }
    });

    dom.targetCancelButton.addEventListener('click', () => {
        const { gameState } = getState();
        dom.targetModal.classList.add('hidden');
        if (gameState) gameState.gamePhase = 'playing';
        updateState('reversusTotalIndividualFlow', false);
        ui.updateTurnIndicator();
    });
    
    dom.reversusTargetScoreButton.addEventListener('click', async () => {
        const { gameState } = getState();
        dom.reversusTargetModal.classList.add('hidden');
        gameState.gamePhase = 'playing';
        await game.playCard(gameState.players['player-1'], gameState.reversusTarget.card, gameState.reversusTarget.targetPlayerId, 'score');
        gameState.reversusTarget = null;
    });

    dom.reversusTargetMovementButton.addEventListener('click', async () => {
        const { gameState } = getState();
        dom.reversusTargetModal.classList.add('hidden');
        gameState.gamePhase = 'playing';
        await game.playCard(gameState.players['player-1'], gameState.reversusTarget.card, gameState.reversusTarget.targetPlayerId, 'movement');
        gameState.reversusTarget = null;
    });

    dom.reversusTargetCancelButton.addEventListener('click', () => {
        dom.reversusTargetModal.classList.add('hidden');
        getState().gameState.gamePhase = 'playing';
        ui.updateTurnIndicator();
    });

    // Reversus Total Choice
    dom.reversusTotalGlobalButton.addEventListener('click', async () => {
        const { gameState } = getState();
        dom.reversusTotalChoiceModal.classList.add('hidden');
        await game.playCard(gameState.players['player-1'], gameState.selectedCard, 'player-1');
    });

    dom.reversusTotalIndividualButton.addEventListener('click', () => {
        updateState('reversusTotalIndividualFlow', true);
        dom.reversusTotalChoiceModal.classList.add('hidden');
        dom.targetModal.classList.remove('hidden');
        dom.targetModalCardName.textContent = "Reversus Individual";
        
        dom.targetPlayerButtonsEl.innerHTML = getState().gameState.playerIdsInGame
            .map(id => {
                const playerObj = getState().gameState.players[id];
                const pIdNum = parseInt(id.split('-')[1]);
                return `<button class="control-button target-player-${pIdNum}" data-target-id="${id}">${playerObj.name}</button>`;
            }).join('');
    });

    dom.reversusTotalChoiceCancel.addEventListener('click', () => {
        dom.reversusTotalChoiceModal.classList.add('hidden');
        getState().gameState.selectedCard = null;
        ui.renderAll();
    });

    dom.reversusIndividualEffectButtons.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON') {
            const { gameState } = getState();
            const effectNameToApply = e.target.dataset.effect;
            const { card, targetPlayerId } = gameState.reversusTarget;
            
            dom.reversusIndividualEffectChoiceModal.classList.add('hidden');
            gameState.gamePhase = 'playing'; // Reset phase before card play
            
            const options = { isIndividualLock: true, effectNameToApply };
            await game.playCard(gameState.players['player-1'], card, targetPlayerId, null, options);
            updateState('reversusTotalIndividualFlow', false);
        }
    });

    dom.reversusIndividualCancelButton.addEventListener('click', () => {
        dom.reversusIndividualEffectChoiceModal.classList.add('hidden');
        getState().gameState.gamePhase = 'playing';
        updateState('reversusTotalIndividualFlow', false);
        ui.updateTurnIndicator();
    });

    dom.fieldEffectInfoCloseButton.addEventListener('click', () => dom.fieldEffectInfoModal.classList.add('hidden'));

    dom.pulaPathButtonsEl.addEventListener('click', (e) => {
        if (e.target.dataset.pathId) {
            handlePulaPathSelection(parseInt(e.target.dataset.pathId, 10));
        }
    });

    dom.pulaCancelButton.addEventListener('click', () => {
        const { gameState } = getState();
        dom.pulaModal.classList.add('hidden');
        gameState.gamePhase = 'playing';
        gameState.pulaTarget = null;
        ui.updateTurnIndicator();
    });

    dom.pathSelectionButtonsEl.addEventListener('click', (e) => {
        if (e.target.dataset.pathId) {
            const { pathSelectionResolver } = getState();
            if (pathSelectionResolver) {
                pathSelectionResolver(parseInt(e.target.dataset.pathId, 10));
                updateState('pathSelectionResolver', null);
                dom.pathSelectionModal.classList.add('hidden');
            }
        }
    });

    dom.nextRoundButton.addEventListener('click', () => {
        // This is now handled by the Promise in showRoundSummaryModal
        // but kept as a fallback.
        dom.roundSummaryModal.classList.add('hidden');
    });

    dom.cardViewerCloseButton.addEventListener('click', () => {
        dom.cardViewerModalEl.classList.add('hidden');
    });

    dom.pvpRoomListCloseButton.addEventListener('click', ui.showSplashScreen);
    
    dom.pvpRoomGridEl.addEventListener('click', (e) => {
        const button = e.target.closest('.pvp-enter-room-button');
        if (button) {
            const roomId = parseInt(button.dataset.roomId, 10);
            const room = getState().pvpRooms.find(r => r.id === roomId);
            if (room.password) {
                updateState('currentEnteringRoomId', roomId);
                dom.pvpRoomListModal.classList.add('hidden');
                dom.pvpPasswordModal.classList.remove('hidden');
            } else {
                dom.pvpRoomListModal.classList.add('hidden');
                dom.pvpUsernameModal.classList.remove('hidden');
                updateState('currentEnteringRoomId', roomId);
            }
        }
    });
    
    dom.pvpUsernameSubmit.addEventListener('click', () => {
        const username = dom.pvpUsernameInput.value;
        if(username.trim()){
            config.PLAYER_CONFIG['player-1'].name = username;
            dom.pvpUsernameModal.classList.add('hidden');
            const roomId = getState().currentEnteringRoomId;
            dom.pvpLobbyModal.classList.remove('hidden');
            ui.updateLobbyUi(roomId);
            ui.addLobbyChatMessage('Sistema', `Você entrou na sala ${roomId}.`);
        }
    });
    
    dom.pvpPasswordSubmit.addEventListener('click', () => {
        const password = dom.pvpPasswordInput.value;
        const roomId = getState().currentEnteringRoomId;
        const room = getState().pvpRooms.find(r => r.id === roomId);
        
        if(password === room.password) {
            dom.pvpPasswordModal.classList.add('hidden');
            dom.pvpUsernameModal.classList.remove('hidden');
        } else {
            alert('Senha incorreta!');
        }
        dom.pvpPasswordInput.value = '';
    });
    
    dom.pvpPasswordCancel.addEventListener('click', () => {
        dom.pvpPasswordModal.classList.add('hidden');
        dom.pvpPasswordInput.value = '';
        dom.pvpRoomListModal.classList.remove('hidden');
    });
    
    dom.pvpLobbyCloseButton.addEventListener('click', () => {
        dom.pvpLobbyModal.classList.add('hidden');
        dom.pvpRoomListModal.classList.remove('hidden');
    });
    
    dom.lobbyStartGameButton.addEventListener('click', async () => {
        const numPlayersMap = {
            'solo-2p': 2, 'solo-3p': 3, 'solo-4p': 4, 'duo': 4
        };
        const mode = dom.lobbyGameModeEl.value;
        const numPlayers = numPlayersMap[mode];
        const gameMode = mode === 'duo' ? 'duo' : 'solo';
        
        const overrides = {};
        let isNarradorChallenge = false;
        let isInversusChallenge = false;
        let isXaelChallenge = false;
        let isNecroFinalChallenge = false;
        
        ['p2', 'p3', 'p4'].forEach(playerPrefix => {
            const selectEl = document.getElementById(`lobby-ai-${playerPrefix}`);
            const playerId = `player-${playerPrefix.slice(1)}`;
            if (selectEl && !selectEl.closest('.hidden')) {
                const aiType = selectEl.value;

                if (aiType === 'narrador') isNarradorChallenge = true;
                if (aiType === 'inversus') isInversusChallenge = true;
                if (aiType === 'xael') isXaelChallenge = true;
                if (aiType === 'necroverso_final') isNecroFinalChallenge = true;

                if (aiType !== 'default') {
                    overrides[playerId] = { aiType: aiType, name: selectEl.options[selectEl.selectedIndex].text };
                }
            }
        });
        
        if (isNarradorChallenge) {
            await game.initializeGame('solo', {
                story: {
                    battle: 'narrador',
                    playerIds: ['player-1', 'player-2'],
                    overrides: { 'player-2': { name: 'Narrador', aiType: 'narrador' } }
                }
            });
        } else if (isInversusChallenge) {
            await game.initializeGame('inversus', {
                numPlayers: 2,
                overrides: {
                    'player-2': { name: 'Inversus', aiType: 'inversus' }
                }
            });
        } else if (isXaelChallenge) {
             await game.initializeGame('solo', { 
                story: { 
                    battle: 'xael_challenge', 
                    playerIds: ['player-1', 'player-2'], 
                    overrides: { 'player-2': { name: 'Xael', aiType: 'xael' } }
                } 
            });
        } else if (isNecroFinalChallenge) {
            // Force the exact 2v2 Story Mode configuration for the Final Battle
            await game.initializeGame('duo', {
                story: {
                    battle: 'necroverso_final',
                    type: '2v2_necro_final',
                    playerIds: ['player-1', 'player-4', 'player-2', 'player-3'],
                    overrides: {
                        'player-2': { name: 'Necroverso Final', aiType: 'necroverso_final' },
                        'player-3': { name: 'Necroverso Final', aiType: 'necroverso_final' },
                        'player-4': { name: 'Versatrix', aiType: 'versatrix' }
                    }
                }
            });
        } else {
            await game.initializeGame(gameMode, { numPlayers, overrides });
        }
    });
    
    dom.lobbyGameModeEl.addEventListener('change', () => ui.updateLobbyUi(getState().currentEnteringRoomId));
    
    dom.lobbyChatSendButton.addEventListener('click', () => {
        const message = dom.lobbyChatInput.value;
        if (message.trim()) {
            ui.addLobbyChatMessage(config.PLAYER_CONFIG['player-1'].name, message);
            dom.lobbyChatInput.value = '';
        }
    });
    
    dom.lobbyChatInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') dom.lobbyChatSendButton.click();
    });

    // Game Menu
    dom.fullscreenButton.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const isFullscreen = !!document.fullscreenElement;
        const enterIcon = document.getElementById('fullscreen-icon-enter');
        const exitIcon = document.getElementById('fullscreen-icon-exit');
        if (enterIcon && exitIcon) {
            enterIcon.classList.toggle('hidden', isFullscreen);
            exitIcon.classList.toggle('hidden', !isFullscreen);
        }
    });
    
    dom.nextTrackButton.addEventListener('click', sound.changeTrack);
    dom.muteButton.addEventListener('click', sound.toggleMute);
    dom.volumeSlider.addEventListener('input', (e) => sound.setVolume(parseFloat(e.target.value)));
    
    dom.debugButton.addEventListener('click', () => {
        const { gameState } = getState();
        if (!gameState) return;
        // Prevent saving in non-story mode or during unsafe game phases
        const isUnsafePhase = gameState.gamePhase !== 'playing' && gameState.gamePhase !== 'paused';
        dom.menuSaveGameButton.disabled = !gameState?.isStoryMode || isUnsafePhase;
        dom.gameMenuModal.classList.remove('hidden');
    });
    
    dom.gameMenuCloseButton.addEventListener('click', () => dom.gameMenuModal.classList.add('hidden'));
    dom.menuSaveGameButton.addEventListener('click', () => {
         dom.gameMenuModal.classList.add('hidden');
         dom.saveGameConfirmModal.classList.remove('hidden');
    });
    dom.saveGameYesButton.addEventListener('click', () => {
        saveLoad.saveGameState();
    });
    dom.saveGameNoButton.addEventListener('click', () => dom.saveGameConfirmModal.classList.add('hidden'));

    dom.menuExitGameButton.addEventListener('click', () => {
        dom.gameMenuModal.classList.add('hidden');
        dom.exitGameConfirmModal.classList.remove('hidden');
    });
    dom.exitGameYesButton.addEventListener('click', () => {
        // This was deleting the save file on exit.
        location.reload(); // Reloads the page to go back to splash
    });
    dom.exitGameNoButton.addEventListener('click', () => dom.exitGameConfirmModal.classList.add('hidden'));

    // Achievements
    dom.achievementsButton.addEventListener('click', () => {
        achievements.renderAchievementsModal();
        dom.achievementsModal.classList.remove('hidden');
    });
    dom.closeAchievementsButton.addEventListener('click', () => dom.achievementsModal.classList.add('hidden'));

    // Xael Challenge Handlers
    dom.xaelPopup.addEventListener('click', async () => {
        const { gameState } = getState();
        if (dom.xaelPopup.classList.contains('hidden') || !gameState) return;
        
        sound.playSoundEffect('destruido');
        sound.announceEffect('VOCÊ FOI DESAFIADO!!!', 'reversus-total', 2000);
        
        // Save pre-challenge state before creating the new game
        const snapshot = structuredClone(gameState);
        updateState('preChallengeGameStateSnapshot', snapshot);

        dom.xaelPopup.classList.add('hidden');
        
        // Start the challenge with correct story setup
        await game.initializeGame('solo', { 
            story: { 
                battle: 'xael_challenge', 
                playerIds: ['player-1', 'player-2'], 
                overrides: { 'player-2': { name: 'Xael', aiType: 'xael' } }
            } 
        });

        // Add explanation after game is initialized and log is cleared
        updateLog({
            type: 'dialogue',
            speaker: 'xael',
            message: 'Xael: "Você me desafiou e agora quero ver vencer! Não bastará chegar ao centro, vencerá no final quem tiver mais estrelas ;)"'
        });
    });

    dom.xaelStarPowerButton.addEventListener('click', () => {
        const { gameState } = getState();
        if (!gameState || !gameState.players['player-1']) return;

        const player = gameState.players['player-1'];
        if (gameState.currentPlayer === 'player-1' && player.hasXaelStarPower && player.xaelStarPowerCooldown === 0) {
            updateLog('Você usou o Poder Estelar do Xael!');
            sound.playSoundEffect('conquista');
            player.xaelStarPowerCooldown = 4; // Set to 4, will become 3 at end of round
            gameState.revealedHands = gameState.playerIdsInGame.filter(id => id !== 'player-1');
            ui.updateXaelStarPowerUI();
            ui.renderAll();
        }
    });

    // Chat Handlers
    const handleChatSubmit = async () => {
        const { gameState } = getState();
        const userInput = dom.chatInput.value.trim();

        if (!userInput || !gameState) return;

        // Disable input while processing
        dom.chatInput.disabled = true;
        dom.chatSendButton.disabled = true;
        
        // Display user's message
        updateLog({
            type: 'dialogue',
            speaker: 'player-1',
            message: `Você: "${userInput}"`
        });
        dom.chatInput.value = '';

        // Determine opponent to talk to (simple logic: first non-human opponent)
        const opponent = Object.values(gameState.players).find(p => !p.isHuman);
        
        if (opponent) {
            try {
                const { getAiChatResponse } = await import('./gemini-ai.js');
                const aiResponse = await getAiChatResponse(userInput, opponent.id);
                updateLog({
                    type: 'dialogue',
                    speaker: opponent.aiType,
                    message: `${opponent.name}: "${aiResponse}"`
                });
            } catch (e) {
                console.error("Chat AI failed:", e);
                updateLog(`[Sistema] A I.A. do oponente não conseguiu responder. Tente novamente.`);
            }
        }

        // Re-enable input
        dom.chatInput.disabled = false;
        dom.chatSendButton.disabled = false;
        dom.chatInput.focus();
    };

    dom.chatSendButton.addEventListener('click', handleChatSubmit);
    dom.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleChatSubmit();
        }
    });

    // Custom Events
    document.addEventListener('startStoryGame', (e) => {
        game.initializeGame(e.detail.mode, e.detail.options);
    });

    document.addEventListener('showSplashScreen', ui.showSplashScreen);
    
    document.addEventListener('storyWinLoss', async (e) => {
        const { battle, won, reason } = e.detail;
        const { gameState, storyState } = getState();
        if(gameState) gameState.gamePhase = 'game_over';
    
        const hardFailBattles = ['contravox', 'reversum', 'necroverso_king', 'necroverso_final', 'narrador', 'xael_challenge'];
    
        if (!won && hardFailBattles.includes(battle)) {
            let loseMessage = "Você Perdeu!";
            if (battle === 'necroverso_final') {
                if (reason === 'collision') loseMessage = "A escuridão te alcançou...";
                else if (reason === 'black_hole') loseMessage = "Você caiu em um buraco negro e foi derrotado.";
                else if (reason === 'time') loseMessage = "O tempo acabou...";
                else loseMessage = "A escuridão consome tudo...";
            } else if (battle === 'narrador') {
                loseMessage = "Você foi um bom oponente...";
            } else if (battle === 'necroverso_king') {
                loseMessage = "Os Reis provaram ser fortes demais...";
            } else if (battle === 'xael_challenge') {
                loseMessage = "Você precisa de mais estrelas para vencer o criador!";
            }
    
            ui.showGameOver(loseMessage, "Você Perdeu!", false);
            achievements.grantAchievement('first_defeat');
            
            setTimeout(() => {
                dom.gameOverModal.classList.add('hidden');
                ui.showSplashScreen();
            }, 3000);
            
            return;
        }
    
        let nextNodeId = null;
        let portrait;
        
        switch(battle) {
            case 'tutorial_necroverso':
            case 'necroverso': // Added alias for old save files
                const lines = won ? config.AI_DIALOGUE.necroverso_tutorial.losing : config.AI_DIALOGUE.necroverso_tutorial.winning;
                ui.showGameOver(lines[Math.floor(Math.random() * lines.length)], won ? "Você Venceu!" : "Você Perdeu!", false);
                achievements.grantAchievement(won ? 'first_win' : 'first_defeat');
                nextNodeId = 'post_tutorial';
                break;
            case 'contravox':
                 portrait = document.querySelector('#player-area-player-3 .player-area-character-portrait');
                 if (portrait) await shatterImage(portrait);
                 ui.showGameOver("!odatorreD .otiderca oãN", "Você Venceu!", false);
                 achievements.grantAchievement('contravox_win');
                 nextNodeId = 'post_contravox_victory';
                 break;
            case 'versatrix':
                if (won) {
                    portrait = document.querySelector('#player-area-player-4 .player-area-character-portrait');
                    if (portrait) await shatterImage(portrait);
                    ui.showGameOver("Obrigada por me vencer... você é diferente", "Você Venceu!", false);
                    achievements.grantAchievement('versatrix_win');
                    nextNodeId = 'post_versatrix_victory';
                } else {
                    ui.showGameOver("Eu avisei...", "Você Perdeu!", false);
                    achievements.grantAchievement('versatrix_loss');
                    storyState.lostToVersatrix = true;
                    nextNodeId = 'post_versatrix_defeat';
                }
                break;
            case 'reversum':
                portrait = document.querySelector('#player-area-player-2 .player-area-character-portrait');
                if (portrait) await shatterImage(portrait);
                ui.showGameOver("EU NÃO POSSO PERDER!", "Você Venceu!", false);
                achievements.grantAchievement('reversum_win');
                nextNodeId = 'post_reversum_victory';
                break;
            case 'necroverso_king':
                // The win is handled by elimination, this is the victory dialogue trigger
                ui.showGameOver("Você libertou os reis... mas não a si mesmo.", "Vitória...?", false);
                achievements.grantAchievement('true_end_beta');
                nextNodeId = 'post_necroverso_king_victory';
                break;
             case 'necroverso_final':
                ui.showGameOver("Parabéns... você conseguiu.", "FINAL FINAL", false);
                achievements.grantAchievement('true_end_final');
                story.playEndgameSequence();
                return; // End of story
            case 'narrador':
                ui.showGameOver("...Fim de Jogo...", "Fim de Jogo.", false);
                // No progression from here yet
                 setTimeout(() => {
                    dom.gameOverModal.classList.add('hidden');
                    ui.showSplashScreen();
                }, 3000);
                return;
            case 'xael_challenge':
                const winMsg = "Você provou ser um verdadeiro mestre de Reversus!";
                const loseMsg = "Heh, você ainda tem muito a aprender.";
                ui.showGameOver(won ? winMsg : loseMsg, won ? "Você Venceu!" : "Você Perdeu!", true); // Show restart
                return; // Restart will handle going back to pre-challenge state
        }
    
        if (nextNodeId) {
            setTimeout(() => {
                dom.gameOverModal.classList.add('hidden');
                dom.storyModeModalEl.classList.remove('hidden');
                story.renderStoryNode(nextNodeId);
            }, 3000);
        }
    });

}