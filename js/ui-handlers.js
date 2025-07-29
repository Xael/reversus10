import * as dom from './dom.js';
import { getState, updateState } from './state.js';
import * as game from './game.js';
import * as ui from './ui.js';
import * as sound from './sound.js';
import * as story from './story.js';
import * as saveLoad from './save-load.js';
import * as achievements from './achievements.js';
import { updateLog } from './utils.js';
import { POSITIVE_EFFECTS, NEGATIVE_EFFECTS, PLAYER_CONFIG } from './config.js';
import { shatterImage } from './animations.js';

function handleCardClick(cardElement) {
    const { gameState } = getState();
    const cardId = parseFloat(cardElement.dataset.cardId);
    if (gameState.currentPlayer !== 'player-1' || gameState.gamePhase !== 'playing' || isNaN(cardId)) {
        return;
    }

    const player = gameState.players['player-1'];
    const card = player.hand.find(c => c.id === cardId);

    if (card) {
        if(gameState.tutorialEffectCardsLocked && card.type === 'effect') return;
        gameState.selectedCard = (gameState.selectedCard?.id === cardId) ? null : card;
        ui.renderAll();
    }
}

function handlePlayerTargetSelection(targetId) {
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
        game.playCard(gameState.players['player-1'], card, targetId);
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

function handlePulaPathSelection(chosenPathId) {
    const { gameState } = getState();
    if (!gameState.pulaTarget) return;
    const { card, targetPlayerId } = gameState.pulaTarget;
    const target = gameState.players[targetPlayerId];
    target.targetPathForPula = chosenPathId;
    updateLog(`${gameState.players['player-1'].name} escolheu que ${target.name} pule para o caminho ${chosenPathId + 1}.`);
    
    dom.pulaModal.classList.add('hidden');
    gameState.gamePhase = 'playing';
    game.playCard(gameState.players['player-1'], card, targetPlayerId);
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
                dom.fieldEffectInfoDescription.textContent = POSITIVE_EFFECTS[effect.name] || NEGATIVE_EFFECTS[effect.name];
                dom.fieldEffectInfoModal.classList.remove('hidden');
            }
        } else if (cardElement) {
            // This will now only run if the click wasn't on a zoom button or indicator
            handleCardClick(cardElement);
        }
    });

    dom.playButton.addEventListener('click', () => {
        const { gameState } = getState();
        const card = gameState.selectedCard;
        if (!card) return;

        if (card.name === 'Reversus Total') {
            dom.reversusTotalChoiceModal.classList.remove('hidden');
            return;
        }

        const effectNeedsTarget = ['Mais', 'Menos', 'Sobe', 'Desce', 'Pula', 'Reversus'].includes(card.name);
        if (effectNeedsTarget) {
            dom.targetModal.classList.remove('hidden');
            dom.targetModalCardName.textContent = card.name;
            
            let targetablePlayers = gameState.playerIdsInGame;
            if (card.name === 'Pula') {
                targetablePlayers = gameState.playerIdsInGame.filter(id => id !== 'player-1');
            }

            dom.targetPlayerButtonsEl.innerHTML = targetablePlayers.map(id => {
                const playerObj = gameState.players[id];
                const pIdNum = parseInt(id.split('-')[1]);
                return `<button class="control-button target-player-${pIdNum}" data-target-id="${id}">${playerObj.name}</button>`;
            }).join('');
        } else {
            game.playCard(gameState.players['player-1'], card, 'player-1');
        }
    });
    
    dom.endTurnButton.addEventListener('click', game.advanceToNextPlayer);
    dom.restartButton.addEventListener('click', ui.showSplashScreen);

    // --- Modal Handlers ---
    dom.targetPlayerButtonsEl.addEventListener('click', (e) => {
        if (e.target.dataset.targetId) {
            handlePlayerTargetSelection(e.target.dataset.targetId);
        }
    });

    dom.targetCancelButton.addEventListener('click', () => {
        const { gameState } = getState();
        dom.targetModal.classList.add('hidden');
        gameState.gamePhase = 'playing';
        updateState('reversusTotalIndividualFlow', false);
        ui.updateTurnIndicator();
    });
    
    dom.reversusTargetScoreButton.addEventListener('click', () => {
        const { gameState } = getState();
        dom.reversusTargetModal.classList.add('hidden');
        game.playCard(gameState.players['player-1'], gameState.reversusTarget.card, gameState.reversusTarget.targetPlayerId, 'score');
    });

    dom.reversusTargetMovementButton.addEventListener('click', () => {
        const { gameState } = getState();
        dom.reversusTargetModal.classList.add('hidden');
        game.playCard(gameState.players['player-1'], gameState.reversusTarget.card, gameState.reversusTarget.targetPlayerId, 'movement');
    });

    dom.reversusTargetCancelButton.addEventListener('click', () => {
        dom.reversusTargetModal.classList.add('hidden');
        getState().gameState.gamePhase = 'playing';
        ui.updateTurnIndicator();
    });

    // Reversus Total Choice
    dom.reversusTotalGlobalButton.addEventListener('click', () => {
        const { gameState } = getState();
        dom.reversusTotalChoiceModal.classList.add('hidden');
        game.playCard(gameState.players['player-1'], gameState.selectedCard, 'player-1');
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

    dom.reversusIndividualEffectButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const { gameState } = getState();
            const effectNameToApply = e.target.dataset.effect;
            const { card, targetPlayerId } = gameState.reversusTarget;
            
            dom.reversusIndividualEffectChoiceModal.classList.add('hidden');
            
            const options = { isIndividualLock: true, effectNameToApply };
            game.playCard(gameState.players['player-1'], card, targetPlayerId, null, options);
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
            PLAYER_CONFIG['player-1'].name = username;
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
    });
    
    dom.pvpLobbyCloseButton.addEventListener('click', () => {
        dom.pvpLobbyModal.classList.add('hidden');
        dom.pvpRoomListModal.classList.remove('hidden');
    });
    
    dom.lobbyStartGameButton.addEventListener('click', () => {
        const numPlayersMap = {
            'solo-2p': 2, 'solo-3p': 3, 'solo-4p': 4, 'duo': 4
        };
        const mode = dom.lobbyGameModeEl.value;
        const numPlayers = numPlayersMap[mode];
        const gameMode = mode === 'duo' ? 'duo' : 'solo';
        
        const overrides = {};
        ['p2', 'p3', 'p4'].forEach(playerPrefix => {
            const selectEl = document.getElementById(`lobby-ai-${playerPrefix}`);
            const playerId = `player-${playerPrefix.slice(1)}`;
            if (selectEl && selectEl.value !== 'default') {
                overrides[playerId] = { aiType: selectEl.value, name: selectEl.options[selectEl.selectedIndex].text };
            }
        });
        
        game.initializeGame(gameMode, { numPlayers, overrides });
    });
    
    dom.lobbyGameModeEl.addEventListener('change', () => ui.updateLobbyUi(getState().currentEnteringRoomId));
    
    dom.lobbyChatSendButton.addEventListener('click', () => {
        const message = dom.lobbyChatInput.value;
        if (message.trim()) {
            ui.addLobbyChatMessage(PLAYER_CONFIG['player-1'].name, message);
            dom.lobbyChatInput.value = '';
        }
    });
    
    dom.lobbyChatInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') dom.lobbyChatSendButton.click();
    });

    // Game Menu
    dom.fullscreenButton.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });
    
    dom.nextTrackButton.addEventListener('click', sound.changeTrack);
    dom.muteButton.addEventListener('click', sound.toggleMute);
    dom.volumeSlider.addEventListener('input', (e) => sound.setVolume(parseFloat(e.target.value)));
    dom.debugButton.addEventListener('click', () => dom.gameMenuModal.classList.remove('hidden'));
    
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
        saveLoad.deleteSavedGame();
        location.reload(); // Reloads the page to go back to splash
    });
    dom.exitGameNoButton.addEventListener('click', () => dom.exitGameConfirmModal.classList.add('hidden'));

    // Achievements
    dom.achievementsButton.addEventListener('click', () => {
        achievements.renderAchievementsModal();
        dom.achievementsModal.classList.remove('hidden');
    });
    dom.closeAchievementsButton.addEventListener('click', () => dom.achievementsModal.classList.add('hidden'));

    // Custom Events
    document.addEventListener('startStoryGame', (e) => {
        game.initializeGame(e.detail.mode, e.detail.options);
    });

    document.addEventListener('showSplashScreen', ui.showSplashScreen);
    
    document.addEventListener('storyWinLoss', async (e) => {
        const { battle, won, reason } = e.detail;
        const { gameState, storyState } = getState();
        if(gameState) gameState.gamePhase = 'game_over';

        document.body.dataset.storyContinuation = 'true';

        let nextNodeId = null;
        
        switch(battle) {
            case 'tutorial_necroverso':
                const lines = won ? config.AI_DIALOGUE.necroverso_tutorial.losing : config.AI_DIALOGUE.necroverso_tutorial.winning;
                ui.showGameOver(lines[Math.floor(Math.random() * lines.length)], won ? "Você Venceu!" : "Você Perdeu!");
                achievements.grantAchievement(won ? 'first_win' : 'first_defeat');
                nextNodeId = 'post_tutorial';
                break;
            case 'contravox':
                 ui.showGameOver(won ? "!otiderca oãN" : "!recnev iov euq aibas uE", won ? "Você Venceu!" : "Você Perdeu!");
                 achievements.grantAchievement(won ? 'contravox_win' : 'first_defeat');
                 if (won) {
                    await shatterImage(document.getElementById('story-character-image')); // Shatter effect on win
                 }
                 nextNodeId = 'post_contravox_victory';
                 break;
            case 'versatrix':
                ui.showGameOver(won ? "Eu pensei... que você era diferente..." : "Obrigada por me deixar vencer...", won ? "Você Venceu!" : "Você Perdeu!");
                if(won) {
                    achievements.grantAchievement('versatrix_win');
                } else {
                    achievements.grantAchievement('versatrix_loss');
                    storyState.lostToVersatrix = true;
                }
                nextNodeId = won ? 'post_versatrix_victory' : 'post_versatrix_defeat';
                break;
            case 'reversum':
                 ui.showGameOver(won ? "...INTERESSANTE" : "FÁCIL DEMAIS", won ? "Você Venceu!" : "Você Perdeu!");
                 achievements.grantAchievement(won ? 'reversum_win' : 'first_defeat');
                 nextNodeId = 'post_reversum_victory';
                 break;
            case 'necroverso_king':
                ui.showGameOver(won ? "Impossível!" : "A vitória é minha!", won ? "Você Venceu!" : "Você Perdeu!");
                achievements.grantAchievement(won ? 'true_end_beta' : 'first_defeat');
                nextNodeId = 'post_necroverso_king_victory';
                break;
            case 'necroverso_final':
                let message = "A escuridão consome tudo...";
                if (reason === 'collision') message = "A escuridão te alcançou...";
                else if (reason === 'black_hole') message = "Você caiu em um buraco negro e foi derrotado.";
                else if (reason === 'time') message = "O tempo acabou...";
                
                if (won) {
                    achievements.grantAchievement('true_end_final');
                    await story.playEndgameSequence();
                } else {
                    achievements.grantAchievement('first_defeat');
                    ui.showGameOver(message, "Você Perdeu!");
                }
                // No next node, game ends here
                break;
        }

        setTimeout(() => {
            dom.gameOverModal.classList.add('hidden');
            if(nextNodeId) {
                dom.storyModeModalEl.classList.remove('hidden');
                story.renderStoryNode(nextNodeId);
            }
             delete document.body.dataset.storyContinuation;
        }, 3000);
    });
    
    // --- Developer Hotkeys ---
    // Removed for production testing
}
