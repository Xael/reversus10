

import { GoogleGenAI, Type } from "@google/genai";
import * as config from './config.js';

let ai;

function getAiInstance() {
  if (!ai) {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set.");
    }
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

function getSystemInstruction(player) {
    const persona = config.AI_DIALOGUE[player.aiType] || config.AI_DIALOGUE['default'];
    return persona.systemInstruction || config.AI_DIALOGUE['default'].systemInstruction;
}

function buildGameContext(player, gameState) {
    const isXaelChallenge = gameState.isXaelChallenge;
    const simplifiedPlayers = gameState.playerIdsInGame.map(pid => {
        const p = gameState.players[pid];
        const isSelf = p.id === player.id;
        const canSeeHand = isSelf || gameState.revealedHands.includes(p.id) || (isXaelChallenge && p.aiType === 'xael');
        
        const playerInfo = {
            id: p.id,
            name: p.name,
            isSelf: isSelf,
            position: p.position,
            liveScore: p.liveScore,
            resto: p.resto,
            effects: p.effects,
            playedCards: p.playedCards,
            hand: canSeeHand ? p.hand : `hidden (${p.hand.length} cards)`,
            playedValueCardThisTurn: p.playedValueCardThisTurn
        };

        if (isXaelChallenge) {
            playerInfo.stars = p.stars;
        }

        return playerInfo;
    });

    const context = {
        currentGameState: {
            round: gameState.turn,
            gameMode: isXaelChallenge ? "Xael Challenge" : gameState.gameMode,
            yourPlayerId: player.id,
            currentPlayerId: gameState.currentPlayer,
            reversusTotalActive: gameState.reversusTotalActive,
            players: simplifiedPlayers,
            activeFieldEffects: gameState.activeFieldEffects,
        }
    };
    
    if (isXaelChallenge) {
        context.gameRules = {
            objective: "Have more stars (⭐) than the opponent when one player reaches space 10. A tie in stars is a loss for the player. Gain stars by landing on Star Spaces.",
            turnAction: "On your turn, you can play effect cards. You MUST play exactly one value card if you have 2 or more in your hand. If you only have 1, you cannot play it. After your actions, you pass the turn.",
            roundEnd: "A round ends when all players pass consecutively. Scores are calculated, and pawns move based on who won the round and card effects.",
            board: "The board has special single-use spaces: Star Spaces (grant 1 star), Blue Spaces (grant 1 star), and Red Spaces (cause star loss/theft)."
        }
    } else {
        context.gameRules = {
            objective: "Be the first player to reach space 10 on the board.",
            turnAction: "On your turn, you can play effect cards. You MUST play exactly one value card if you have 2 or more in your hand. If you only have 1, you cannot play it. After your actions, you pass the turn.",
            roundEnd: "A round ends when all players pass consecutively. Scores are calculated, and pawns move based on who won the round and card effects.",
        }
    }


    return context;
}

export async function getGeminiAiMove(player, gameState) {
    const genAI = getAiInstance();
    
    const systemInstruction = getSystemInstruction(player);
    const gameContext = buildGameContext(player, gameState);
    
    const prompt = `
        You are playing the card game Reversus. Here is the current state of the game:
        ${JSON.stringify(gameContext, null, 2)}
        
        Based on your persona and the game state, decide your next move.
        Your available actions are to play a card or to pass your turn.
        Consider playing effect cards early to establish an advantage or disrupt opponents, even in the first round.
        Remember the rule: If you have 2 or more value cards, you MUST play one.
        If you choose to play a card that requires a target (like 'Mais', 'Menos', 'Sobe', 'Desce', 'Pula', 'Reversus'), you must provide a valid targetPlayerId from the list of players.
        If playing 'Reversus', you must also specify the effectTypeToReverse ('score' or 'movement').
        Your response must be in the specified JSON format.
    `;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        action: { 
          type: Type.STRING,
          enum: ['play_card', 'pass_turn'],
          description: "The action to take."
        },
        cardId: {
          type: Type.NUMBER,
          description: "The ID of the card to play from your hand. Null if passing.",
          nullable: true,
        },
        targetId: {
          type: Type.STRING,
          description: "The player ID to target with the card. Can be your own ID. Null if not applicable.",
          nullable: true,
        },
        effectTypeToReverse: {
          type: Type.STRING,
          enum: ['score', 'movement'],
          description: "Required only if playing a 'Reversus' card.",
          nullable: true,
        },
        reasoning: {
            type: Type.STRING,
            description: "A brief explanation of why you chose this move."
        }
      },
      required: ['action', 'reasoning']
    };

    try {
        const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.9, // Higher temperature for more varied AI behavior
            }
        });
        
        const jsonText = result.text.trim();
        const move = JSON.parse(jsonText);
        
        console.log(`Gemini AI (${player.name}) move:`, move);
        return move;

    } catch (error) {
        console.error("Error getting Gemini AI move:", error);
        // This error will be caught by the fallback logic in game.js
        throw error; 
    }
}