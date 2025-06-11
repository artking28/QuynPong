const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 1110, host: '0.0.0.0' });

let players = [];
let queue = [];

const GAME_STATE = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    POINT_SCORED: 'point_scored',
    GAME_OVER: 'game_over'
};
let currentGameState = GAME_STATE.WAITING;

const GAME_TICK_RATE = 1000 / 60;
const DELAY_AFTER_POINT_MS = 2000;
let gameInterval;
let delayTimeout;

let ball = {
    x: 50,
    y: 50,
    dx: 0,
    dy: 0
};

let playerPaddles = [50, 50]; // Posição X central de cada raquete (em %)
let playerScores = [0, 0]; // Pontuação de cada jogador

const PADDLE_WIDTH_PERCENT = (100 / 350) * 100;
const PADDLE_HEIGHT_PERCENT = (15 / 700) * 100;
const BALL_SIZE_PERCENT_X = (10 / 350) * 100;
const BALL_SIZE_PERCENT_Y = (10 / 700) * 100;

const INITIAL_BALL_SPEED = 1;

function resetBall() {
    ball.x = 50;
    ball.y = 50;
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
    ball.dy = (Math.random() > 0.5 ? 1 : -1) * INITIAL_BALL_SPEED;
}

function resetPaddles() {
    playerPaddles = [50, 50];
}

function startGameLoop() {
    if (gameInterval) clearInterval(gameInterval);
    resetBall();
    resetPaddles();
    currentGameState = GAME_STATE.PLAYING;
    gameInterval = setInterval(gameTick, GAME_TICK_RATE);
    console.log('Loop de jogo iniciado.');
}

function stopGameLoop() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
        console.log('Loop de jogo parado.');
    }
    if (delayTimeout) {
        clearTimeout(delayTimeout);
        delayTimeout = null;
    }
}

function gameTick() {
    if (currentGameState !== GAME_STATE.PLAYING) {
        return;
    }

    const prevBallX = ball.x;
    const prevBallY = ball.y;

    ball.x += ball.dx;
    ball.y += ball.dy;

    const ballHalfWidth = BALL_SIZE_PERCENT_X / 2;
    const ballHalfHeight = BALL_SIZE_PERCENT_Y / 2;

    const ballLeft = ball.x - ballHalfWidth;
    const ballRight = ball.x + ballHalfWidth;
    const ballTop = ball.y - ballHalfHeight;
    const ballBottom = ball.y + ballHalfHeight;

    // const prevBallLeft = prevBallX - ballHalfWidth;
    // const prevBallRight = prevBallX + ballHalfWidth;
    const prevBallTop = prevBallY - ballHalfHeight;
    const prevBallBottom = prevBallY + ballHalfHeight;


    if (ballLeft < 0) {
        ball.dx *= -1;
        ball.x = ballHalfWidth;
    } else if (ballRight > 100) {
        ball.dx *= -1;
        ball.x = 100 - ballHalfWidth;
    }

    const player1PaddleYTop = 100 - PADDLE_HEIGHT_PERCENT;
    const player1PaddleLeftEdge = playerPaddles[0] - PADDLE_WIDTH_PERCENT / 2;
    const player1PaddleRightEdge = playerPaddles[0] + PADDLE_WIDTH_PERCENT / 2;

    if (ball.dy > 0 &&
        ballBottom >= player1PaddleYTop &&
        prevBallBottom < player1PaddleYTop &&
        ballRight > player1PaddleLeftEdge &&
        ballLeft < player1PaddleRightEdge) {
        ball.dy *= -1;
        ball.y = player1PaddleYTop - ballHalfHeight;

        ball.dx *= 1.05;
        ball.dy *= 1.05;
        let hitPos = (ball.x - playerPaddles[0]) / (PADDLE_WIDTH_PERCENT / 2);
        ball.dx += hitPos * 0.2;
    }

    const player2PaddleYBottom = PADDLE_HEIGHT_PERCENT;
    const player2PaddleLeftEdge = playerPaddles[1] - PADDLE_WIDTH_PERCENT / 2;
    const player2PaddleRightEdge = playerPaddles[1] + PADDLE_WIDTH_PERCENT / 2;

    if (ball.dy < 0 &&
        ballTop <= player2PaddleYBottom &&
        prevBallTop > player2PaddleYBottom &&
        ballRight > player2PaddleLeftEdge &&
        ballLeft < player2PaddleRightEdge) {
        ball.dy *= -1;
        ball.y = player2PaddleYBottom + ballHalfHeight;

        ball.dx *= 1.05;
        ball.dy *= 1.05;
        let hitPos = (ball.x - playerPaddles[1]) / (PADDLE_WIDTH_PERCENT / 2);
        ball.dx += hitPos * 0.2;
    }

    let from = null;
    if (ballTop < 0) {
        scored = true;
        playerScores[0]++;
        from = 'player';
        // console.log('Ponto para o jogador 1!', playerScores[0], "-", playerScores[1]);
    } else if (ballBottom > 100) {
        scored = true;
        playerScores[1]++;
        from = 'opponent';
        // console.log('Ponto para o jogador 2!', playerScores[0], "-", playerScores[1]);
    }

    if (from != null) {
        currentGameState = GAME_STATE.POINT_SCORED;
        players.forEach(playerWs => {
            if (playerWs.readyState === WebSocket.OPEN) {                
                let real = playerWs.playerId == 1 ? [playerScores[0], playerScores[1]] : [playerScores[1], playerScores[0]];
                playerWs.send(JSON.stringify({ type: 'point_scored', message: 'Ponto!', from: from, scores: real }));        
            }
        });
        
        if(playerScores[0] >= 4 || playerScores[1] >= 4) {
            players.forEach(playerWs => {
                playerWs.send(JSON.stringify({ type: 'game_over', message: 'Game over!' }));
            })
            currentGameState = GAME_STATE.GAME_OVER;
            if(queue.length > 0) {
                if (playerScores[0] >= 4) {
                    const loser = players.pop();
                    queue.push(loser)
                    loser.send(JSON.stringify({ type: 'game_in_progress', message: `Jogo ocorrendo, seu lugar na fila ${queue.length-1}` }));
                    players.push(queue.shift())
                } else {
                    const loser = players.shift();
                    queue.push(loser)
                    loser.send(JSON.stringify({ type: 'game_in_progress', message: `Jogo ocorrendo, seu lugar na fila ${queue.length-1}` }));
                    players.push(queue.shift())
                }   
                players[0].playerId = 1
                players[0].send(JSON.stringify({ type: 'game_start', message: 'O jogo vai começar!', playerRole: 'opponent' }));
                players[1].playerId = 0
                players[1].send(JSON.stringify({ type: 'game_start', message: 'O jogo vai começar!', playerRole: 'player' }));
            }
            playerScores[0] = 0 
            playerScores[1] = 0
        }

        delayTimeout = setTimeout(() => {
            resetBall();
            resetPaddles();
            currentGameState = GAME_STATE.PLAYING;
            players.forEach(playerWs => {
                if (playerWs.readyState === WebSocket.OPEN) {
                    playerWs.send(JSON.stringify({ type: 'round_start', message: 'Nova rodada!' }));
                }
                // NOVO: SEMPRE envia a posição inicial dos paddles com o playerId
                playerWs.send(JSON.stringify({ type: 'paddle_move', x: playerPaddles[0], playerId: players[0].playerId }));
                playerWs.send(JSON.stringify({ type: 'paddle_move', x: playerPaddles[1], playerId: players[1].playerId }));
            });
        }, DELAY_AFTER_POINT_MS);
    }

    if (currentGameState === GAME_STATE.PLAYING || currentGameState === GAME_STATE.POINT_SCORED) {
        players.forEach(playerWs => {
            if (playerWs.readyState === WebSocket.OPEN) {
                playerWs.send(JSON.stringify({ type: 'ball_update', position: { x: ball.x, y: ball.y } }));
            }
        });
    }
}


console.log('Servidor WebSocket iniciado na porta 1110');

wss.on('connection', function connection(ws) {
    if (players.length < 2) {
        // ws.playerId = crypto.randomUUID();
        players.push(ws);
        ws.playerId = players.length + queue.length - 1;

        if (players.length === 2) {
            console.log('Dois jogadores conectados. Jogo começando!');
            players.forEach((playerWs, index) => {
                playerWs.send(JSON.stringify({
                    type: 'game_start',
                    message: 'O jogo vai começar!',
                    playerRole: index === 0 ? 'player' : 'opponent'
                }));
                
                // NOVO: Garante que os clientes recebam a posição inicial (central) de AMBOS os paddles
                playerWs.send(JSON.stringify({ type: 'paddle_move', x: playerPaddles[0], playerId: players[0].playerId }));
                playerWs.send(JSON.stringify({ type: 'paddle_move', x: playerPaddles[1], playerId: players[1].playerId }));
            });
            startGameLoop();
        } else {
            ws.send(JSON.stringify({ type: 'waiting_for_player', message: 'Esperando outro jogador...' }));
        }
    } else {
        queue.push(ws);
        const positionInQueue = queue.length;
        ws.send(JSON.stringify({ type: 'game_in_progress', message: `Jogo ocorrendo, seu lugar na fila ${positionInQueue}` }));
    }

    ws.on('message', function incoming(message) {
        const data = JSON.parse(message);

        if (data.type === 'paddle_move' && players.includes(ws) && currentGameState === GAME_STATE.PLAYING) {
            playerPaddles[ws.playerId] = data.x;

            // Retransmite a posição com o playerId, para o cliente saber qual paddle atualizar
            players.forEach(playerWs => {
                if (playerWs.readyState === WebSocket.OPEN) { // Envia para todos, inclusive o remetente, para sincronização
                    playerWs.send(JSON.stringify({ type: 'paddle_move', x: data.x, playerId: ws.playerId }));
                }
            });
        }
    });

    ws.on('close', function close() {
        console.log(`Cliente ${ws.playerId !== undefined ? ws.playerId : 'na fila'} desconectado.`);

        const playerIndex = players.indexOf(ws);
        if (playerIndex > -1) {
            id = players[playerIndex].playerId
            players.splice(playerIndex, 1);
            if (players.length === 1) {
                if (players[0].playerId === 1) {
                    players[0].playerId = 0;
                    players[0].send(JSON.stringify({
                        type: 'your_turn',
                        message: 'Um jogador se desconectou. Você está entrando no jogo como Jogador 1!',
                        playerRole: 'player'
                    }));
                }
            }

            console.log(`Jogador ativo desconectado. Jogadores ativos restantes: ${players.length}`);

            if (players.length < 2 && queue.length > 0) {
                const nextPlayer = queue.shift();
                players.push(nextPlayer);
                nextPlayer.playerId = players.length - 1;
                nextPlayer.send(JSON.stringify({
                    type: 'your_turn',
                    message: 'Um jogador se desconectou. Você está entrando no jogo!',
                    playerRole: nextPlayer.playerId === 0 ? 'player' : 'opponent'
                }));
                console.log('Jogador da fila entrou no jogo.');

                if (players.length === 2) {
                    currentGameState = GAME_STATE.PLAYING;
                    console.log('Dois jogadores novamente. Jogo continua/recomeça!');
                    players.forEach((playerWs, index) => {
                         playerWs.send(JSON.stringify({
                            type: 'game_start',
                            message: 'O jogo foi retomado!',
                            playerRole: index === 0 ? 'player' : 'opponent'
                        }));
                        // NOVO: Garante que os clientes recebam a posição inicial (central) de AMBOS os paddles
                        playerWs.send(JSON.stringify({ type: 'paddle_move', x: playerPaddles[0], playerId: 0 }));
                        playerWs.send(JSON.stringify({ type: 'paddle_move', x: playerPaddles[1], playerId: 1 }));
                    });
                    startGameLoop();
                }
            } else if (players.length === 0) {
                currentGameState = GAME_STATE.WAITING;
                console.log('Todos os jogadores desconectados. Jogo aguardando novos jogadores.');
                stopGameLoop();
            }
        } else {
            const queueIndex = queue.indexOf(ws);
            if (queueIndex > -1) {
                queue.splice(queueIndex, 1);
            }
        }
    });

    ws.on('error', function error(err) {
        console.error('Erro no WebSocket:', err);
    });
});