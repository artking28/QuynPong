import React, {useState, useEffect, useRef} from 'react';
import './App.css';
import {Ball} from "../share/models/Ball.js";
import {Paddle} from "../share/models/Paddle.js";
import {seconds} from "../share/utils/utils.js";

const WS_URL = 'ws://localhost:3000';

export default function PongApp() {
    const ws = useRef(null);

    const [name, setName] = useState('');
    const [connected, setConnected] = useState(false);
    const [queue, setQueue] = useState([]);
    const [players, setPlayers] = useState([]);
    const [nameConfirmed, setNameConfirmed] = useState(false);
    const [chat, setChat] = useState([]);
    const [message, setMessage] = useState('');

    const containerRef = useRef();
    const greenPointRef = useRef();
    const redPointRef = useRef();
    const canvasRef = useRef();

    useEffect(() => {
        if (!nameConfirmed) return;

        const greenPoint = greenPointRef.current;
        const redPoint = redPointRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const GREEN = "#32a86d";
        const RED = "#e83f3f";
        const PADDLE_HEIGHT = 10;
        const PADDLE_WIDTH = 100;
        const PADDLE_RADIUS = 5;
        const PLAYER_SPEED = 10;
        const BALL_SPEED = 400;
        const frameRate = 1000 / 200;

        let moveR = false;
        let moveL = false;
        let greenPointValue = 0;
        let redPointValue = 0;
        let isInverted = false;
        let start = false;
        let forceRenderOnPause = 1;

        let xPos = (canvas.width - PADDLE_WIDTH) / 2;
        let ball = new Ball(canvas.width / 2, canvas.height / 2, "white", 5, BALL_SPEED);
        let player1 = new Paddle(xPos, canvas.height - 20, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, GREEN);
        let player2 = new Paddle(xPos, 10, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, RED);

        const swap = () => {
            player1.swap(canvas);
            player2.swap(canvas);
            ball.swap(canvas);
            forceRenderOnPause++;
            isInverted = !isInverted;
        };

        const restart = () => {
            ball = new Ball(canvas.width / 2, canvas.height / 2, "white", 5, BALL_SPEED);
            player1 = new Paddle(xPos, canvas.height - 20, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, GREEN);
            player2 = new Paddle(xPos, 10, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, RED);
            start = false
            forceRenderOnPause++
            setTimeout(() => {
                start = true
            }, seconds(3))

            if (greenPointValue === 4 || redPointValue === 4) {
                greenPointValue = 0;
                redPointValue = 0;
            }

            if (isInverted) {
                isInverted = false;
                swap();
            }
        };

        let animationFrameId
        const loop = () => {
            if (!start && forceRenderOnPause <= 0) {
                animationFrameId = window.requestAnimationFrame(loop)
                return
            }
            forceRenderOnPause = Math.max(forceRenderOnPause - 1, 0);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            player1.draw(ctx);
            player2.draw(ctx);

            if (moveR) player1.x = Math.min(player1.x + PLAYER_SPEED, canvas.width - PADDLE_WIDTH);
            if (moveL) player1.x = Math.max(player1.x - PLAYER_SPEED, 0);

            ball.draw(ctx);
            ball.update(frameRate, canvas);

            const hit = (b, p) => {
                return b.x >= p.x &&
                    b.x <= p.x + p.width &&
                    b.y + b.radius >= p.y - PADDLE_HEIGHT &&
                    b.y - b.radius <= p.y + PADDLE_HEIGHT;
            }

            const inv = (isInverted ? -1 : 1)
            if (hit(ball, player1)) {
                ball.dy = -Math.abs(ball.dy) * inv;
                ball.intervene()
            }
            if (hit(ball, player2)) {
                ball.dy = Math.abs(ball.dy) * inv;
                ball.intervene()
            }

            if (ball.y <= 5) {
                if (!isInverted) {
                    greenPointValue++;
                    greenPoint.textContent = greenPointValue;
                } else {
                    redPointValue++;
                    redPoint.textContent = redPointValue;
                }
                restart();
            }

            if (ball.y >= canvas.height - 5) {
                if (!isInverted) {
                    redPointValue++;
                    redPoint.textContent = redPointValue;
                } else {
                    greenPointValue++;
                    greenPoint.textContent = greenPointValue;
                }
                restart();
            }

            animationFrameId = window.requestAnimationFrame(loop)
        }
        loop()

        const keyDown = (e) => {
            if (["a", "arrowleft"].includes(e.key.toLowerCase())) moveL = true;
            if (["d", "arrowright"].includes(e.key.toLowerCase())) moveR = true;
            if (e.key === "Shift") swap();
            if (e.code === "Space") start = true;
        };

        const keyUp = (e) => {
            if (["a", "arrowleft"].includes(e.key.toLowerCase())) moveL = false;
            if (["d", "arrowright"].includes(e.key.toLowerCase())) moveR = false;
        };

        document.addEventListener("keydown", keyDown);
        document.addEventListener("keyup", keyUp);

        return () => {
            window.cancelAnimationFrame(animationFrameId)
            document.removeEventListener("keydown", keyDown);
            document.removeEventListener("keyup", keyUp);
        };
    }, [nameConfirmed]);

    useEffect(() => {
        if (!containerRef.current) {
            return
        }

        containerRef.current.scrollTop = containerRef.current.scrollHeight;

        const handleScroll = () => {
            const mask = 'linear-gradient(to bottom, transparent 0, #0e0e0e 40%)';
            const none = 'linear-gradient(to bottom, transparent 0, #0e0e0e 0)';
            containerRef.current.style.maskImage = containerRef.current.scrollTop > 50 ? mask : none;
            containerRef.current.style.webkitMaskImage = containerRef.current.scrollTop > 50 ? mask : none;
        };

        containerRef.current.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => containerRef.current.removeEventListener('scroll', handleScroll);
    }, [chat]);

    useEffect(() => {
        ws.current = new WebSocket(WS_URL);

        ws.current.onopen = () => setConnected(true);

        ws.current.onmessage = e => {
            const data = JSON.parse(e.data);
            if (data.type === 'state') {
                setQueue(data.content.queue);
                setPlayers(data.content.players);
                setChat(data.content.chatMessages);
            } else if (data.type === 'chat') {
                setChat(data.content);
            }
        };

        return () => ws.current.close();
    }, []);

    function formatarData(data) {
        const d = new Date(data);
        const agora = new Date();

        const ehHoje = d.toDateString() === agora.toDateString();

        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        const ehOntem = d.toDateString() === ontem.toDateString();

        const horas = d.getHours().toString().padStart(2, '0');
        const minutos = d.getMinutes().toString().padStart(2, '0');

        if (ehHoje) return `Hoje às ${horas}:${minutos}`;
        if (ehOntem) return `Ontem às ${horas}:${minutos}`;

        const dia = d.getDate().toString().padStart(2, '0');
        const mes = (d.getMonth() + 1).toString().padStart(2, '0');
        const ano = d.getFullYear().toString().slice(-2);

        return `${dia}/${mes}/${ano} ${horas}:${minutos}`;
    }

    function join() {
        if (name.trim()) {
            ws.current.send(JSON.stringify({type: 'join', name}));
            setNameConfirmed(true);  // só aqui confirma o nome
        }
    }

    function sendChat() {
        if (message.trim()) {
            ws.current.send(JSON.stringify({type: 'chat', text: message, createdAt: Date.now()}));
            setMessage('');
        }
    }

    function startGame() {
        ws.current.send(JSON.stringify({type: 'startGame'}));
    }

    return (
        <div id="main" style={{gridTemplateColumns: nameConfirmed ? '20% auto 20%' : 'auto'}}>

            {nameConfirmed ? (
                <>
                    {/* Chat */}
                    <div id="chat" className="sec">
                        <h2>Chat</h2>
                        <div id="messages" ref={containerRef}>
                            {chat.map((c, i) => (
                                <div
                                    className={"message" + (c.from === "system" ? " system" : (name === c.from ? " mine" : ""))}
                                    key={i}>
                                    {c.from !== "system" ? (
                                        <b>{c.from ?? "Unknown"}:</b>
                                    ) : null}
                                    <label className="content">{c.text}</label>
                                    {c.from !== "system" ? (
                                        <label className="date">{formatarData(c.createdAt)}</label>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                        <div id="footer">
                            <input value={message}
                                   onChange={e => setMessage(e.target.value)}
                                   onKeyDown={e => e.key === 'Enter' && sendChat()}
                                   placeholder="Mensagem no chat"
                            />
                            <button onClick={sendChat}>Enviar</button>
                        </div>
                    </div>

                    {/* Jogo Pong - placeholder */}
                    <div id="game" className="sec">
                        <h1>Quyn-pong</h1>
                        <div id={"canvaDiv"}>
                            <canvas ref={canvasRef} width={0.45*window.innerHeight} height={0.75*window.innerHeight} />
                            <label>
                                <span ref={redPointRef} style={{ color: "#e83f3f" }}>0</span>
                                <span style={{ color: "white" }}> - </span>
                                <span ref={greenPointRef} style={{ color: "#32a86d" }}>0</span>
                            </label>
                        </div>
                    </div>


                    {/* Fila */}
                    <div id="fila" className="sec">
                        <h2>Fila</h2>
                        <ol>
                            {queue.map((p, i) => <li key={i}>{p} {p === name ? '(Você)' : ''}</li>)}
                        </ol>
                    </div>
                </>
            ) : null}

            {/*/!* Input nome *!/*/}
            {!nameConfirmed ? (
                <div id="nameInput">
                    <input value={name}
                           placeholder={"Nickname"}
                           onChange={e => setName(e.target.value)}
                           onKeyDown={e => e.key === 'Enter' && join()}
                    />
                    <button onClick={join}>Entrar</button>
                </div>
            ) : null}
        </div>
    );
}
