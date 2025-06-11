import React, { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';

const WS_URL = 'ws://192.168.15.124:1110';
const GAME_TICK_RATE = 1000 / 60;

const GAME_WIDTH = 350;
const GAME_HEIGHT = 700;

const PADDLE_WIDTH = 100; // Largura do paddle em pixels
const PADDLE_HEIGHT = 15;
const BALL_SIZE = 10;

function App() {
    const [messages, setMessages] = useState([]);
    const [gameState, setGameState] = useState('loading');
    const [queuePosition, setQueuePosition] = useState(0);
    const ws = useRef(null);
    const canvasRef = useRef(null);
    const scoreRef = useRef(null);

    // playerPaddleX e opponentPaddleX armazenam o CENTRO X do paddle em pixels
    const playerPaddleX = useRef(GAME_WIDTH / 2); // Começa no centro
    const opponentPaddleX = useRef(GAME_WIDTH / 2); // Começa no centro
    const ballPosition = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 });

    const paddleSpeed = 5;
    const keysPressed = useRef({});

    const myPlayerRole = useRef(null);
    const myPlayerId = useRef(null);

    const drawGame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#101010';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // NOVO: Desenha a raquete do jogador (inferior), ajustando X para o canto superior esquerdo
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(playerPaddleX.current - PADDLE_WIDTH / 2, canvas.height - PADDLE_HEIGHT, PADDLE_WIDTH, PADDLE_HEIGHT);

        // NOVO: Desenha a raquete do oponente (superior), ajustando X para o canto superior esquerdo
        ctx.fillStyle = '#f44336';
        ctx.fillRect(opponentPaddleX.current - PADDLE_WIDTH / 2, 0, PADDLE_WIDTH, PADDLE_HEIGHT);

        // Desenha a bola (o arc já usa o centro para o X,Y)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(ballPosition.current.x, ballPosition.current.y, BALL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();

        if (gameState === 'point_scored') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);

            ctx.font = '20px "Avenir"';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Nova rodada em 2 segundos...', canvas.width / 2, canvas.height / 2);
        }

    }, [gameState]);

    useEffect(() => {
        let animationFrameId;
        const render = () => {
            drawGame();
            animationFrameId = requestAnimationFrame(render);
        };

        if (gameState === 'playing' || gameState === 'point_scored') {
            animationFrameId = requestAnimationFrame(render);
        }

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [gameState, drawGame]);

    useEffect(() => {
        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => {
            setGameState('waiting');
            setMessages(prev => [...prev, 'Conectado ao servidor.']);
        };

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'waiting_for_player':
                    setGameState('waiting');
                    setMessages(prev => [...prev, data.message]);
                    break;
                case 'game_start':
                    setGameState('playing');
                    setMessages(prev => [...prev, data.message]);
                    myPlayerRole.current = data.playerRole;
                    myPlayerId.current = (data.playerRole === 'player' ? 0 : 1);

                    ballPosition.current = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
                    break;
                case 'game_in_progress':
                    setGameState('queued');
                    const parts = data.message.split(' ');
                    setQueuePosition(parts[parts.length - 1]);
                    setMessages(prev => [...prev, data.message]);
                    break;
                // case 'your_turn':
                //     setGameState('playing');
                //     setMessages(prev => [...prev, data.message]);
                //     myPlayerRole.current = data.playerRole;
                //     myPlayerId.current = (data.playerRole === 'player' ? 0 : 1);

                //     ballPosition.current = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 };
                //     break;
                case 'paddle_move':
                    const newPaddleX = (data.x / 100) * GAME_WIDTH; // X é o centro do paddle em pixels

                    console.log(data.playerId)
                    console.log(myPlayerId.current)
                    console.log("============================")
                    if (data.playerId === myPlayerId.current) {
                        playerPaddleX.current = newPaddleX;
                    } else {
                        opponentPaddleX.current = newPaddleX;
                    }
                    break;
                case 'ball_update':
                    let receivedBallY = (data.position.y / 100) * GAME_HEIGHT;

                    if (myPlayerRole.current === 'opponent') {
                        receivedBallY = GAME_HEIGHT - receivedBallY;
                    }

                    ballPosition.current = {
                        x: (data.position.x / 100) * GAME_WIDTH,
                        y: receivedBallY
                    };
                    break;
                case 'game_over':
                    setGameState('game_over');
                    setMessages(prev => [...prev, data.message]);
                    break;
                case 'point_scored':
                    setGameState('point_scored');
                    setMessages(prev => [...prev, data.message]);                
                    let enemy = '<span class="material-symbols-rounded enemy">close_small</span>'.repeat(data.scores[0]);
                    let normal = '<span class="material-symbols-rounded normal">circle</span>'.repeat(7 - (data.scores[0] + data.scores[1]));
                    let mine = '<span class="material-symbols-rounded mine">check_small</span>'.repeat(data.scores[1]);
                    let scoreDataHTML = enemy + normal + mine;
                    scoreRef.current.innerHTML = scoreDataHTML;
                    break;
                case 'round_start':
                    setGameState('playing');
                    setMessages(prev => [...prev, data.message]);
                    break;
                default:
                    setMessages(prev => [...prev, data.message || JSON.stringify(data)]);
                    break;
            }
        };

        ws.current.onclose = () => {
            setGameState('disconnected');
            setMessages(prev => [...prev, 'Desconectado do servidor.']);
        };

        ws.current.onerror = (error) => {
            console.error('Erro no WebSocket:', error);
            setGameState('error');
            setMessages(prev => [...prev, 'Erro na conexão.']);
        };

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const updatePaddlePosition = useCallback(() => {
        if (gameState === 'playing' && ws.current && ws.current.readyState === WebSocket.OPEN) {
            let newX = playerPaddleX.current; // playerPaddleX.current já é o centro

            if (keysPressed.current['ArrowLeft']) {
                newX -= paddleSpeed;
            }
            if (keysPressed.current['ArrowRight']) {
                newX += paddleSpeed;
            }

            // Limitar o movimento da raquete dentro da área do canvas
            // O limite é o X do CENTRO do paddle.
            const minX = PADDLE_WIDTH / 2; // O centro não pode ir para a esquerda de metade da largura
            const maxX = GAME_WIDTH - PADDLE_WIDTH / 2; // O centro não pode ir para a direita de metade da largura

            const clampedX = Math.max(minX, Math.min(maxX, newX));

            if (clampedX !== playerPaddleX.current) {
                playerPaddleX.current = clampedX;

                const percentX = (clampedX / GAME_WIDTH) * 100;
                ws.current.send(JSON.stringify({ type: 'paddle_move', x: percentX, playerId: myPlayerId.current }));
            }
        }
    }, [gameState, paddleSpeed]);

    useEffect(() => {
        let gameLoopInterval;
        if (gameState === 'playing') {
            gameLoopInterval = setInterval(updatePaddlePosition, GAME_TICK_RATE);
        }

        return () => {
            clearInterval(gameLoopInterval);
        };
    }, [gameState, updatePaddlePosition]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (gameState === 'playing' || gameState === 'point_scored') {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    keysPressed.current[event.key] = true;
                    event.preventDefault();
                }
            }
        };

        const handleKeyUp = (event) => {
            if (gameState === 'playing' || gameState === 'point_scored') {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    keysPressed.current[event.key] = false;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]);

    return (
        <div className={`App ${gameState === 'playing' ? 'playing' : ''}`}>
            <h1>Quyn-pong</h1>

            {(gameState === 'loading' && gameState !== 'disconnected') && (
                <p>Conectando ao servidor...</p>
            )}
            {(gameState === 'waiting' && gameState !== 'disconnected') && (
                <p>Esperando outro jogador...</p>
            )}
            {(gameState === 'playing' || gameState === 'point_scored') && (
                <>
                    <p>Jogo em andamento! Use as setas <kbd>&#8592;</kbd> e <kbd>&#8594;</kbd> para mover sua raquete.</p>
                    <div id="all">
                        <canvas ref={canvasRef}
                            width={GAME_WIDTH}
                            height={GAME_HEIGHT}
                            className="game-canvas"
                        ></canvas>
                        <div id="score" ref={scoreRef}></div>
                    </div>
                </>
            )}
            {(gameState === 'queued' && gameState !== 'disconnected') && (
                <p>Já existe um jogo ocorrendo, Por favor, aguarde sua vez. <br/>Você está na {queuePosition}º posição da fila.</p>
            )}
            {gameState === 'game_over' && <p>Fim de jogo.</p>}
            {gameState === 'disconnected' && <p>Desconectado do servidor.</p>}
            {gameState === 'error' && <p>Ocorreu um erro na conexão.</p>}

            {/* <h3>Mensagens do Servidor:</h3>
            <div className="messages">
                {messages.map((msg, index) => (
                    <p key={index}>{msg}</p>
                ))}
            </div> */}
        </div>
    );
}

export default App;