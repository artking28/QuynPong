import React, {useState, useEffect, useRef} from 'react';
import './App.css';
import {Ball} from "../share/models/Ball.js";
import {Paddle} from "../share/models/Paddle.js";
import {seconds} from "../share/utils/utils.js";

const WS_URL = 'ws://192.168.15.52:1110/'

export default function PongApp() {
    const ws = useRef(null);

    const [name, setName] = useState('');
    const [_, setConnected] = useState(false);
    const [queue, setQueue] = useState([]);
    const [nameConfirmed, setNameConfirmed] = useState(false);
    const [chat, setChat] = useState([]);
    const [message, setMessage] = useState('');

    const player2ControlRef = useRef({moveL: false, moveR: false});
    const ballControlRef = useRef(new Ball())
    const startGameControlRef = useRef(false)

    const containerRef = useRef();
    const greenPointRef = useRef();
    const redPointRef = useRef();
    const canvasRef = useRef();

    const GREEN = "#32a86d";
    const RED = "#e83f3f";
    const PADDLE_HEIGHT = 10;
    const PADDLE_WIDTH = 100;
    const PADDLE_RADIUS = 5;
    const PLAYER_SPEED = 10;
    const BALL_SPEED = 400;
    const frameRate = 1000 / 200;

    useEffect(() => {
        if (!nameConfirmed) return;

        const greenPoint = greenPointRef.current;
        const redPoint = redPointRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");


        let moveR = false;
        let moveL = false;
        let greenPointValue = 0;
        let redPointValue = 0;
        let isInverted = false;
        let forceRenderOnPause = 1;

        let xPos = (canvas.width - PADDLE_WIDTH) / 2;
        let player1 = new Paddle(xPos, canvas.height - 20, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, GREEN);
        let player2 = new Paddle(xPos, 10, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, RED);

        const swap = () => {
            player1.swap(canvas);
            player2.swap(canvas);
            ballControlRef.current.swap(canvas);
            forceRenderOnPause++;
            isInverted = !isInverted;
        };

        const restart = () => {
            ballControlRef.current = new Ball(canvas.width / 2, canvas.height / 2, "white", 5, BALL_SPEED);
            player1 = new Paddle(xPos, canvas.height - 20, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, GREEN);
            player2 = new Paddle(xPos, 10, PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_RADIUS, RED);
            startGameControlRef.current = false
            forceRenderOnPause++
            setTimeout(() => {
                startGameControlRef.current = true
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
            if (!startGameControlRef.current && forceRenderOnPause <= 0) {
                animationFrameId = window.requestAnimationFrame(loop)
                return
            }
            forceRenderOnPause = Math.max(forceRenderOnPause - 1, 0);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            player1.draw(ctx);
            player2.draw(ctx);

            if (!startGameControlRef.current) {
                if (queue[0] && queue[0].done) {
                    ctx.fillText("Ok", 40, 25 * window.innerHeight)
                } else {
                    ctx.fillText("Wait", 40, 25 * window.innerHeight)
                }
                if (queue[1] && queue[1].done) {
                    ctx.fillText("Ok", 40, 50 * window.innerHeight)
                } else {
                    ctx.fillText("Wait", 40, 50 * window.innerHeight)
                }
            }

            if (moveR) player1.x = Math.min(player1.x + PLAYER_SPEED, canvas.width - PADDLE_WIDTH);
            if (moveL) player1.x = Math.max(player1.x - PLAYER_SPEED, 0);

            console.log(player2ControlRef.current.moveR)
            console.log(player2ControlRef.current.moveL)
            if (player2ControlRef.current.moveR) player2.x = Math.min(player2.x + PLAYER_SPEED, canvas.width - PADDLE_WIDTH);
            if (player2ControlRef.current.moveL) player2.x = Math.max(player2.x - PLAYER_SPEED, 0);

            ballControlRef.current.draw(ctx);
            ballControlRef.current.update(frameRate, canvas);

            const hit = (b, p) => {
                return b.x >= p.x && b.x <= p.x + p.width &&
                    b.y + b.radius >= p.y - PADDLE_HEIGHT &&
                    b.y - b.radius <= p.y + PADDLE_HEIGHT;
            }

            const inv = (isInverted ? -1 : 1)
            if (hit(ballControlRef.current, player1)) {
                ballControlRef.current.dy = -Math.abs(ballControlRef.current.dy) * inv;
                ballControlRef.current.intervene()
            }
            if (hit(ballControlRef.current, player2)) {
                ballControlRef.current.dy = Math.abs(ballControlRef.current.dy) * inv;
                ballControlRef.current.intervene()
            }

            if (ballControlRef.current.y <= 5) {
                if (!isInverted) {
                    greenPointValue++;
                    greenPoint.textContent = greenPointValue;
                } else {
                    redPointValue++;
                    redPoint.textContent = redPointValue;
                }
                restart();
            }

            if (ballControlRef.current.y >= canvas.height - 5) {
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
            if (["a", "arrowleft"].includes(e.key.toLowerCase())) {
                moveL = true;
                ws.current.send(JSON.stringify({type: 'playerControl', text: 'moveR'}));
            }
            if (["d", "arrowright"].includes(e.key.toLowerCase())) {
                moveR = true;
                ws.current.send(JSON.stringify({type: 'playerControl', text: 'moveL'}));
            }
            if (e.code === "Space" && (name === queue[0].name || name === queue[1].name)) {

                ws.current.send(JSON.stringify({type: 'startGame', text: name}))
            }
            if (e.key === "Shift") swap();
        };

        const keyUp = (e) => {
            if (["a", "arrowleft"].includes(e.key.toLowerCase())) {
                moveL = false;
                ws.current.send(JSON.stringify({type: 'playerControl', text: 'stopR'}));
            }
            if (["d", "arrowright"].includes(e.key.toLowerCase())) {
                moveR = false;
                ws.current.send(JSON.stringify({type: 'playerControl', text: 'stopL'}));
            }
        };

        document.addEventListener("keydown", keyDown);
        document.addEventListener("keyup", keyUp);

        return () => {
            window.cancelAnimationFrame(animationFrameId)
            document.removeEventListener("keydown", keyDown);
            document.removeEventListener("keyup", keyUp);
        };
    }, [frameRate, name, nameConfirmed, player2ControlRef, queue, startGameControlRef, ws]);

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
                setChat(data.content.chatMessages);
            } else if (data.type === 'chat') {
                setChat(data.content);
            } else if (data.type === 'game') {
                ballControlRef.current = new Ball(canvasRef.current.width / 2, canvasRef.current.height / 2, "white", 5, BALL_SPEED);
                startGameControlRef.current = true
            } else if (data.type === 'stop') {
                ballControlRef.current = new Ball(canvasRef.current.width / 2, canvasRef.current.height / 2, "white", 5, BALL_SPEED);
                startGameControlRef.current = true
            } else if (data.type === 'control') {
                if (data.content.from === name) return;
                if (data.content.control === 'moveL') player2ControlRef.current.moveL = true;
                if (data.content.control === 'moveR') player2ControlRef.current.moveR = true;
                if (data.content.control === 'stopL') player2ControlRef.current.moveL = false;
                if (data.content.control === 'stopR') player2ControlRef.current.moveR = false;
            }
        };

        return () => ws.current.close();
    }, [name]);

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
                        {!nameConfirmed ? (
                            <div id="footer">
                                <input value={message}
                                       onChange={e => setMessage(e.target.value)}
                                       onKeyDown={e => e.key === 'Enter' && sendChat()}
                                       placeholder="Mensagem no chat"
                                />
                                <button onClick={sendChat}>Enviar</button>
                            </div>
                        ) : null}
                    </div>

                    {/* Jogo Pong - placeholder */}
                    <div id="game" className="sec">
                        <h1>Quyn-pong</h1>
                        <label>O jogo é uma melhor de 7 e a cada ponto, há uma pausa de 3 segundos.</label>
                        <div id={"canvaDiv"}>
                            <canvas ref={canvasRef} width={0.45 * window.innerHeight}
                                    height={0.75 * window.innerHeight}/>
                            <label>
                                <span ref={redPointRef} style={{color: "#e83f3f"}}>0</span>
                                <span style={{color: "white"}}> - </span>
                                <span ref={greenPointRef} style={{color: "#32a86d"}}>0</span>
                            </label>
                        </div>
                    </div>


                    {/* Fila */}
                    <div id="fila" className="sec">
                        <h2>Fila</h2>
                        <ol>
                            {queue.map((p, i) => <li key={i}>{p.name} {p.name === name ? '(Você)' : ''}</li>)}
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
