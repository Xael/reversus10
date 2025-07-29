import { getState, updateState } from './state.js';
import * as config from './config.js';
import * as dom from './dom.js';
import { updateLog, shuffle } from './utils.js';
import { renderPlayerArea, renderAll, updateTurnIndicator, showGameOver, renderBoard } from './ui.js';
import { animateNecroX } from './animations.js';
import { announceEffect, playSoundEffect } from './sound.js';
import { applyEffect } from './game.js';

/**
 * Triggers Necroverso's "NECRO X" ability.
 * @param {object} caster - The Necroverso player object.
 */
export async function triggerNecroX(caster) {
    const { gameState } = getState();
    gameState.necroXUsedThisRound = true;
    updateLog({ type: 'dialogue', speaker: caster.aiType, message: `${caster.name}: "Essa é a minha melhor carta!"` });

    playSoundEffect('x');
    document.body.classList.add('screen-shaking');
    animateNecroX();

    // Remove shake class after animation
    setTimeout(() => {
        document.body.classList.remove('screen-shaking');
    }, 400); // Match CSS animation duration

    await new Promise(res => setTimeout(res, 1000)); // Wait for drama

    const necroXCard = { id: Date.now() + Math.random(), type: 'effect', name: 'NECRO X', casterId: caster.id };
    
    const scoreEffectCategory = ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido'];
    const oldScoreCardIndex = caster.playedCards.effect.findIndex(c => scoreEffectCategory.includes(c.name));
    if (oldScoreCardIndex > -1) {
        const [oldCard] = caster.playedCards.effect.splice(oldScoreCardIndex, 1);
        gameState.decks.effect.push(oldCard);
    }
    caster.playedCards.effect.push(necroXCard);
    applyEffect(necroXCard, caster.id, caster.name);
    renderAll();
}

/**
 * Triggers Contravox's "OÃSUFNOC" ability.
 */
export async function triggerContravox() {
    const { gameState } = getState();
    updateLog("Contravox usa sua habilidade: OÃSUFNOC!");
    playSoundEffect('confusao');
    announceEffect("OÃSUFNOC", "reversus-total", 2000);

    dom.storyScreenFlashEl.style.backgroundColor = 'black';
    dom.storyScreenFlashEl.classList.remove('hidden');
    
    await new Promise(res => setTimeout(() => {
        dom.storyScreenFlashEl.classList.add('hidden');
        dom.storyScreenFlashEl.style.backgroundColor = 'white';
        gameState.player1CardsObscured = true;
        renderAll();
        res();
    }, 1000));
}

/**
 * Attempts to have an AI character speak a line of dialogue during their turn.
 * @param {object} aiPlayer - The AI player object.
 */
export async function tryToSpeak(aiPlayer) {
    const { gameState } = getState();
    const dialogueConfig = config.AI_DIALOGUE[aiPlayer.aiType];

    // Give the AI a 60% chance to NOT speak, to reduce chatter.
    if (Math.random() > 0.4) {
        return;
    }

    if (!dialogueConfig) {
        return;
    }

    const currentState = aiPlayer.status; // 'winning', 'losing', or 'neutral'
    
    let linesForState;

    // Use specific lines if available, otherwise pool all lines for neutral state.
    if (currentState === 'winning' && dialogueConfig.winning) {
        linesForState = dialogueConfig.winning;
    } else if (currentState === 'losing' && dialogueConfig.losing) {
        linesForState = dialogueConfig.losing;
    } else {
        linesForState = [...(dialogueConfig.winning || []), ...(dialogueConfig.losing || [])];
    }

    if (!linesForState || linesForState.length === 0) {
        return; // No lines available for this AI at all.
    }

    const lineToSpeak = shuffle(linesForState)[0];
    updateLog({ type: 'dialogue', speaker: aiPlayer.aiType, message: `${aiPlayer.name}: "${lineToSpeak}"` });
}

const showPlayerTargetModalForFieldEffect = (title, prompt, targetIds) => {
    return new Promise(resolve => {
        const { gameState } = getState();
        gameState.gamePhase = 'field_effect_targeting';
        updateState('fieldEffectTargetingInfo', { resolve });
        
        dom.targetModalCardName.textContent = title;
        dom.targetModal.querySelector('p').textContent = prompt;
        
        dom.targetPlayerButtonsEl.innerHTML = targetIds.map(id => {
            const targetPlayer = gameState.players[id];
            const playerIdNumber = id.split('-')[1];
            return `<button class="control-button target-player-${playerIdNumber}" data-target-id="${id}">${targetPlayer.name}</button>`;
        }).join('');
        
        dom.targetModal.classList.remove('hidden');
        updateTurnIndicator();
        renderAll();
    });
};

const performTrade = (playerAId, playerBId, tradeType, gameState) => {
    const playerA = gameState.players[playerAId];
    const playerB = gameState.players[playerBId];

    const valueCardsA = playerA.hand.filter(c => c.type === 'value').sort((a,b) => a.value - b.value);
    const valueCardsB = playerB.hand.filter(c => c.type === 'value').sort((a,b) => a.value - b.value);

    if (valueCardsA.length === 0 || valueCardsB.length === 0) {
        updateLog(`Troca de cartas entre ${playerA.name} e ${playerB.name} falhou: um dos jogadores não tem cartas de valor.`);
        return;
    }

    const cardFromA = tradeType === 'justa' ? valueCardsA[0] : valueCardsA[valueCardsA.length - 1];
    const cardFromB = tradeType === 'justa' ? valueCardsB[valueCardsB.length - 1] : valueCardsB[0];
    
    playerA.hand = playerA.hand.filter(c => c.id !== cardFromA.id);
    playerB.hand = playerB.hand.filter(c => c.id !== cardFromB.id);

    playerA.hand.push(cardFromB);
    playerB.hand.push(cardFromA);

    updateLog(`${playerA.name} trocou a carta ${cardFromA.name} pela carta ${cardFromB.name} de ${playerB.name}.`);
};

/**
 * Triggers all active field effects at the start of a round.
 */
export async function triggerFieldEffects() {
    const { gameState } = getState();
    updateTurnIndicator();
    
    const contravoxAI = Object.values(gameState.players).find(p => p.aiType === 'contravox');
    if (contravoxAI && gameState.contravoxAbilityUses > 0) {
        const player1 = gameState.players['player-1'];
        if (player1 && [3, 6, 9].includes(player1.position)) {
            await triggerContravox();
            gameState.contravoxAbilityUses--;
        }
    }

    for (const playerId of gameState.playerIdsInGame) {
        const player = gameState.players[playerId];
        if (player.isEliminated || player.pathId === -1) continue;

        if (player.aiType === 'reversum') {
            const path = gameState.boardPaths[player.pathId];
            if (!path) continue;
            const space = path.spaces[player.position - 1];
            if (space && (space.color === 'red' || space.color === 'blue') && !space.isUsed) {
                updateLog(`${player.name} é imune a efeitos de campo e não ativa o espaço.`);
                space.isUsed = true;
                continue;
            }
        }
        
        const path = gameState.boardPaths[player.pathId];
        if (!path || player.position < 1 || player.position > config.BOARD_SIZE) continue;
        
        const spaceIndex = player.position - 1;
        const space = path.spaces[spaceIndex];
        
        if (!space || space.isUsed) continue;

        // Handle space effects
        if (space.color === 'red' || space.color === 'blue' || space.color === 'yellow' || space.color === 'black') {
            
            space.isUsed = true; // Use up the space immediately
            gameState.gamePhase = 'field_effect';
            
            // Yellow Space (Versatrix)
            if (space.color === 'yellow') {
                if (gameState.versatrixPowerDisabled) {
                    updateLog("Casa de Versatrix está inativa!");
                    continue;
                }
                dom.versatrixFieldModal.classList.remove('hidden');
                await new Promise(resolve => dom.versatrixFieldContinueButton.onclick = () => {
                    dom.versatrixFieldModal.classList.add('hidden');
                    resolve();
                });

                if (gameState.isFinalBoss) {
                    updateLog(`${player.name} ativou uma Casa de Versatrix! Efeitos são aplicados a todos.`);

                    const applyLoopingMovement = (p, move) => {
                        if (!p || p.isEliminated) return;
                        const oldPos = p.position;
                        // Using modulo for clean wrap-around logic for the 1-10 board.
                        const newPos = ((((oldPos - 1) + move) % 10) + 10) % 10 + 1;
                        p.position = newPos;
                        updateLog(`${p.name} moveu de ${oldPos} para ${p.position}.`);
                    };

                    const player1 = gameState.players['player-1'];
                    const versatrix = Object.values(gameState.players).find(p => p.aiType === 'versatrix');
                    const necros = Object.values(gameState.players).filter(p => p.aiType === 'necroverso_final');

                    applyLoopingMovement(player1, 1);
                    applyLoopingMovement(versatrix, 1);
                    necros.forEach(necro => applyLoopingMovement(necro, -1));
                } else { // Original Versatrix battle logic
                    if (player.aiType === 'versatrix') {
                        player.position = Math.min(config.WINNING_POSITION, player.position + 1);
                        updateLog(`Versatrix caiu em sua casa especial e avançou para ${player.position}.`);
                    } else {
                        player.position = Math.max(1, player.position - 1);
                        updateLog(`${player.name} caiu na casa de Versatrix e voltou para ${player.position}.`);
                    }
                }
                renderBoard();
                continue;
            }
            
            // Black Hole (Necroverso Final)
            if (space.color === 'black') {
                updateLog(`${player.name} caiu em um Buraco Negro!`);
                announceEffect("Buraco Negro!", "negative", 2500);
                await new Promise(res => setTimeout(res, 2500));
                space.color = 'white'; // Neutralize space visually
                if (player.isHuman) {
                    document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_final', won: false, reason: 'black_hole' }}));
                    return; // End processing
                }
                if (player.aiType === 'versatrix') {
                    player.isEliminated = true;
                    gameState.versatrixPowerDisabled = true;
                    updateLog("Versatrix foi eliminada pelo Buraco Negro! Seus poderes se foram.");
                    // Neutralize all yellow spaces on the board
                    gameState.boardPaths.forEach(path => {
                        path.spaces.forEach(space => {
                            if (space.color === 'yellow') {
                                space.color = 'white';
                                space.effectName = null;
                            }
                        });
                    });
                    renderBoard();
                }
                if (player.aiType === 'necroverso_final') {
                    updateLog("Necroverso é imune ao Buraco Negro!");
                }
                continue; // Move to next player after handling black hole
            }
            
            // Red/Blue spaces
            const effectType = space.color === 'blue' ? 'positive' : 'negative';
            const effectName = space.effectName;
            const effectDescription = config.POSITIVE_EFFECTS[effectName] || config.NEGATIVE_EFFECTS[effectName];
            
            // Show modal
            dom.fieldEffectModal.classList.remove('hidden');
            dom.fieldEffectTitle.textContent = `${player.name} ativou um Efeito de Campo!`;
            dom.fieldEffectCardEl.className = `field-effect-card ${effectType}`;
            dom.fieldEffectNameEl.textContent = effectName;
            dom.fieldEffectDescriptionEl.textContent = effectDescription;
            await new Promise(resolve => dom.fieldEffectContinueButton.onclick = () => {
                dom.fieldEffectModal.classList.add('hidden');
                resolve();
            });

            // Prepare effect object
            const effect = { name: effectName, type: effectType };
            
            // Determine who the effect applies to
            let appliesTo = [playerId];
            if (gameState.gameMode === 'duo' && !gameState.isFinalBoss) {
                const team = config.TEAM_A.includes(playerId) ? config.TEAM_A : config.TEAM_B;
                const partnerId = team.find(id => id !== playerId);
                if (partnerId && gameState.players[partnerId]) {
                    appliesTo.push(partnerId);
                }
            }
            effect.appliesTo = appliesTo[0]; // Simplified for now, will expand below
            
            updateLog(`Efeito de Campo '${effectName}' ativado por ${player.name}.`);

            // Apply effect logic
            const allPlayers = Object.values(gameState.players);
            
            const handleCardDraw = (p, preferHigh) => {
                const valueCards = p.hand.filter(c => c.type === 'value').sort((a,b) => a.value - b.value);
                if (valueCards.length === 0) return;
                const cardToDiscard = preferHigh ? valueCards[valueCards.length-1] : valueCards[0];
                p.hand = p.hand.filter(c => c.id !== cardToDiscard.id);
                if(gameState.decks.value.length > 0) p.hand.push(gameState.decks.value.pop());
                updateLog(`${p.name} descartou a carta ${cardToDiscard.name} e comprou uma nova.`);
            };

            switch (effectName) {
                case 'Reversus Total':
                    gameState.reversusTotalActive = true;
                    dom.appContainerEl.classList.add('reversus-total-active');
                    dom.reversusTotalIndicatorEl.classList.remove('hidden');
                    break;
                
                case 'Jogo Aberto':
                    if (effectType === 'positive') {
                        gameState.revealedHands = allPlayers.filter(p => p.id !== playerId).map(p => p.id);
                    } else {
                        gameState.revealedHands.push(playerId);
                    }
                    break;
                
                case 'Carta Menor':
                    appliesTo.forEach(id => handleCardDraw(gameState.players[id], false));
                    break;

                case 'Carta Maior':
                    appliesTo.forEach(id => handleCardDraw(gameState.players[id], true));
                    break;
                
                case 'Troca Justa': {
                    const opponents = allPlayers.filter(p => p.id !== playerId);
                    const targetId = player.isHuman 
                        ? await showPlayerTargetModalForFieldEffect('Troca Justa', 'Escolha um oponente para trocar cartas.', opponents.map(p=>p.id))
                        : shuffle(opponents)[0].id;
                    if(targetId) performTrade(playerId, targetId, 'justa', gameState);
                    break;
                }
                
                case 'Troca Injusta': {
                    const opponents = allPlayers.filter(p => p.id !== playerId);
                    const targetId = shuffle(opponents)[0].id; // Random opponent
                    performTrade(playerId, targetId, 'injusta', gameState);
                    break;
                }

                case 'Total Revesus Nada!':
                    if (gameState.gameMode === 'duo') {
                        const playerWithEffect = gameState.players[playerId];
                        const partner = gameState.players[appliesTo.find(id => id !== playerId)];
                        // Discard one random effect card from activator
                        const effectCards = playerWithEffect.hand.filter(c => c.type === 'effect');
                        if (effectCards.length > 0) {
                            const cardToDiscard = shuffle(effectCards)[0];
                            playerWithEffect.hand = playerWithEffect.hand.filter(c => c.id !== cardToDiscard.id);
                        }
                        // Partner discards until 1 effect card is left
                        if (partner) {
                            const partnerEffectCards = partner.hand.filter(c => c.type === 'effect');
                            while(partner.hand.filter(c=>c.type === 'effect').length > 1) {
                                const cardToDiscard = partner.hand.find(c => c.type === 'effect');
                                if(cardToDiscard) partner.hand = partner.hand.filter(c => c.id !== cardToDiscard.id);
                            }
                        }
                    } else {
                         // Solo mode
                        const playerWithEffect = gameState.players[playerId];
                        const effectCards = playerWithEffect.hand.filter(c => c.type === 'effect');
                        playerWithEffect.hand = playerWithEffect.hand.filter(c => c.type !== 'effect');
                        gameState.decks.effect.push(...effectCards);
                    }
                    updateLog(`Efeito de '${effectName}' fez jogadores descartarem cartas de efeito.`);
                    break;

                default:
                    // For effects like Imunidade, Resto Maior/Menor, etc.
                    // Push them to activeFieldEffects to be checked during the round.
                     appliesTo.forEach(id => {
                        gameState.activeFieldEffects.push({ ...effect, appliesTo: id });
                    });
            }
        }
    }
}