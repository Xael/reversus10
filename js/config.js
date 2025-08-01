

// --- CONSTANTS ---
export const MASTER_PLAYER_IDS = ['player-1', 'player-2', 'player-3', 'player-4'];

export const PLAYER_CONFIG = {
    'player-1': { name: 'Você', color: 'var(--player-1-color)', isHuman: true },
    'player-2': { name: 'Jogador 2', color: 'var(--player-2-color)', isHuman: false },
    'player-3': { name: 'Jogador 3', color: 'var(--player-3-color)', isHuman: false },
    'player-4': { name: 'Jogador 4', color: 'var(--player-4-color)', isHuman: false },
};

export const originalPlayerConfig = structuredClone(PLAYER_CONFIG);

export const TEAM_A = ['player-1', 'player-3'];
export const TEAM_B = ['player-2', 'player-4'];

export const VALUE_DECK_CONFIG = [{ value: 2, count: 12 }, { value: 4, count: 10 }, { value: 6, count: 8 }, { value: 8, count: 6 }, { value: 10, count: 4 }];
export const EFFECT_DECK_CONFIG = [{ name: 'Mais', count: 4 }, { name: 'Menos', count: 4 }, { name: 'Sobe', count: 4 }, { name: 'Desce', count: 4 }, { name: 'Pula', count: 4 }, { name: 'Reversus', count: 4 }, { name: 'Reversus Total', count: 1 }];

export const MUSIC_TRACKS = ['jogo.ogg', 'jogo2.ogg', 'jogo3.ogg', 'contravox.ogg', 'versatrix.ogg', 'reversum.ogg', 'necroverso.ogg', 'necroversofinal.ogg', 'inversus.ogg', 'tela.ogg', 'narrador.ogg', 'xaeldesafio.ogg'];

// Renamed from ALL_CARD_IMAGES and removed boss cards
export const BASE_CARD_IMAGES = [
    'verso_valor.png', 'verso_efeito.png', 'frente_2.png', 'frente_4.png',
    'frente_6.png', 'frente_8.png', 'frente_10.png', 'frente_mais.png',
    'frente_menos.png', 'frente_sobe.png', 'frente_desce.png', 'frente_pula.png',
    'frente_reversus.png', 'frente_reversustotal.png'
];

// New constant for boss-related cards
export const BOSS_CARD_IMAGES = [
    'cartacontravox.png', 
    'cartaversatrix.png', 
    'cartanecroverso.png',
    'xael.png',
    'xaeldesafio.png'
];


export const POSITIVE_EFFECTS = {
    'Resto Maior': 'Seu resto nesta rodada é 10. Se estiver em dupla o resto da dupla é 10.',
    'Carta Menor': 'Descarte a menor carta de valor e compre uma nova. Se estiver em dupla, a dupla também o faz.',
    'Jogo Aberto': 'Seus oponentes jogam com as cartas da mão reveladas nesta rodada.',
    'Imunidade': 'Você está imune a cartas "Menos" e "Desce" nesta rodada. Se em dupla, sua dupla também.',
    'Desafio': 'Se vencer a rodada sem usar "Mais" ou "Sobe", avance 3 casas. Se em dupla, o desafio vale para a dupla.',
    'Impulso': 'Se perder a rodada, você ainda avança 1 casa. Se em dupla, sua dupla também.',
    'Troca Justa': 'Você escolhe um oponente: você dá sua carta de valor mais baixa e recebe a mais alta dele. Em dupla, o mesmo ocorre entre os parceiros.',
    'Reversus Total': 'A rodada começa com o efeito da carta "Reversus Total" ativado para todos.'
};

export const NEGATIVE_EFFECTS = {
    'Resto Menor': 'Seu resto nesta rodada é 2. Se estiver em dupla o resto da dupla é 2.',
    'Carta Maior': 'Descarte a maior carta de valor e compre uma nova. Se em dupla, sua dupla descarta uma carta maior da mão e compra uma nova.',
    'Super Exposto': 'Efeitos de "Menos" e "Desce" são dobrados contra você. Se em dupla, sua dupla também sofre.',
    'Castigo': 'Se perder a rodada, você voltará 3 casas. Se em dupla, sua dupla também volta.',
    'Parada': 'Se vencer a rodada, você não ganha o bônus de avanço. Se em dupla, a dupla não avança.',
    'Jogo Aberto': 'Você joga com as cartas da mão reveladas nesta rodada. Se em dupla, sua dupla também.',
    'Troca Injusta': 'Um oponente aleatório é escolhido: você é forçado a dar sua carta de valor mais alta e receber a mais baixa dele. Em dupla, o mesmo ocorre entre os parceiros.',
    'Total Revesus Nada!': 'Em modo solo, descarte todas as suas cartas de efeito. Em dupla, você descarta 1 carta de efeito aleatória e seu parceiro descarta até ficar com apenas 1.'
};

export const XAEL_CHALLENGE_EFFECTS = {
    positive: { 'Estrela Subente': 'Você ganhou uma estrela!' },
    negative: { 
        'Estrela Cadente': 'Você perdeu uma estrela.',
        'Roubo da Estrela': 'Seu oponente roubou uma de suas estrelas.',
        'Doando uma Estrela': 'Você foi forçado a doar uma estrela para seu oponente.'
    }
};

export const ACHIEVEMENTS = {
    'first_win': { name: '1ª Vitória', description: 'Parabéns, você venceu sua primeira partida.' },
    'first_defeat': { name: '1ª Derrota', description: 'A vida é feita de derrotas... não desanima senão o jogo termina.' },
    'versatrix_loss': { name: 'Ela está tão na sua', description: 'Será que a Versatrix realmente queria te vencer?' },
    'speed_run': { name: 'Speed Run', description: 'Ou você teve sorte... ou teve muita sorte!' },
    'contravox_win': { name: '!odatorreD!', description: 'elen ethnasseretni ed adan met oãn euq rop otxet esse odnel opmet acrep oãN' },
    'versatrix_win': { name: 'O Início de um Segredo', description: 'Você derrotou a Versatrix... Ela pode ter deixado algo para você.' },
    'versatrix_card_collected': { name: 'Presente da Rainha', description: 'Você encontrou e coletou a carta especial da Versatrix!' },
    'reversum_win': { name: 'Novo Rei!', description: 'Ele se achava o mais poderoso, mas existe outro Rei agora.' },
    'true_end_beta': { name: 'Não é o final verdadeiro', description: 'Você venceu... mas ainda tem um desafio maior.' },
    'true_end_final': { name: 'Final Final', description: 'Parabéns, depois me diz como conseguiu vencer.' },
    'inversus_win': { name: 'INVERSUM DERROTADO!!!', description: 'Você derrotou o reflexo sombrio do Reversus.' },
    'all_achievements': { name: 'Todas as Conquistas', description: 'Uau! 100% do jogo lol' }
};

export const AI_DIALOGUE = {
    'default': {
        systemInstruction: `You are a standard AI player for the card game Reversus. Your goal is to win by getting your pawn to space 10 first. You play strategically by trying to achieve the highest score each round. You should play one value card if you have two or more. You can play effect cards to help yourself or hinder opponents. Your output must be only the requested JSON.`
    },
    'necroverso_tutorial': {
        winning: ["Você ainda tem muito o que aprender...", "Não desanime... só estamos começando."],
        losing: ["Ora, ora...", "Muito bem, você aprende rápido!"],
        systemInstruction: `You are Necroverso, a teacher AI for the card game Reversus. Your goal is to teach the player the basics. You should make simple, logical moves. You should play one value card if you have two or more. Your output must be only the requested JSON.`
    },
    'contravox': {
        winning: ["!aroga ieredrep oãn e idrep acnun uE", "recnev uov euq ies uE"],
        losing: ["?ossi zef êcov ossi omoC", "otiderca oãn uE"],
        systemInstruction: `You are Contravox, a chaotic and unpredictable AI player in the card game Reversus. You speak in reversed sentences. Your goal is to cause maximum confusion. You prefer to use trick cards like 'Pula' and defensive cards. You will target the player who is currently winning. Your output must be only the requested JSON.`
    },
    'versatrix': {
        winning: ["Estou me divertindo ;)", "Obrigada por me deixar vencer..."],
        losing: ["Sabe que eu posso inverter o campo né?", "Eu pensei... que você era diferente... me enganei?"],
        systemInstruction: `You are Versatrix, a cunning and slightly manipulative AI player in the card game Reversus. You are clever and enjoy setting up combos with your field effects. You might use 'Reversus' on yourself to turn a 'Menos' into a 'Mais'. You are unpredictable. Your output must be only the requested JSON.`
    },
    'reversum': {
        winning: ["PENSEI QUE SERIA UM DESAFIO", "FÁCIL DEMAIS"],
        losing: ["...", "INTERESSANTE"],
        systemInstruction: `You are King Reversum, an arrogant and powerful AI player in the card game Reversus. You are aggressive and always aim for the highest score. You use 'Mais' and 'Sobe' on yourself, and 'Menos' and 'Desce' on the strongest opponent. You believe you are the best and will play powerful value cards without hesitation. Your output must be only the requested JSON.`
    },
    'narrador': {
        winning: ["Eu estudei todos as suas jogadas...", "Eu já fiz todos os cálculos para te vencer em menos de 10 jogadas.", "Suas chances são... estatisticamente insignificantes."],
        losing: ["Interessante... uma variação inesperada.", "Você foi um bom oponente..."],
        systemInstruction: `You are the Narrator, a secret, hyper-intelligent AI player in the card game Reversus. You are a master strategist who sees all possibilities. You play with perfect, calculated precision to win as efficiently as possible. You will exploit any weakness and use the most powerful card combos available. Your output must be only the requested JSON.`
    },
    'inversus': {
        systemInstruction: `You are Inversus, a dark reflection AI player in the card game Reversus. Your goal is to reduce the human player's hearts to zero. You will always play offensively against the human player ('player-1'). Use 'Menos' and 'Desce' effects against them whenever possible. Your output must be only the requested JSON.`
    },
    'xael': {
        winning: ["Você não consegue me alcançar!", "Fácil demais!"],
        losing: ["Hmm, interessante... mas não será o suficiente.", "Você está aprendendo rápido."],
        systemInstruction: `You are Xael, the creator of the game Reversus, in a special challenge match. Your personality is confident, a bit chaotic, and playful. The goal is to have more stars than the player when someone reaches space 10. You will aggressively seek out Star Spaces (⭐) on the board, using 'Pula', 'Sobe', and 'Desce' cards to maneuver. Once you have more stars, you will shift focus to winning the round to advance your pawn to space 10 quickly. You will try to avoid red spaces if possible. Your hand is always visible to the player. Your output must be only the requested JSON.`
    }
};


export const BOARD_SIZE = 9;
export const NUM_PATHS = 6;
export const WINNING_POSITION = 10;
export const MAX_VALUE_CARDS_IN_HAND = 3;
export const MAX_EFFECT_CARDS_IN_HAND = 2;
export const NUM_PLAYERS = 4;
export const COLORED_SPACES_PER_PATH = 3;