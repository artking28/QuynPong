import React, {useState, useEffect, useRef} from 'react';
import './App.css';

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
    const canvasRef = useRef();

    useEffect(() => {
        if (!players.includes(name)) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        let paddleX = canvas.width / 2 - 40;
        const paddleY = 10;
        let ballX = canvas.width / 2;
        let ballY = canvas.height / 2;
        let ballDX = 2;
        let ballDY = -3;

        let left = false;
        let right = false;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.fillRect(paddleX, paddleY, 80, 10);
            ctx.beginPath();
            ctx.arc(ballX, ballY, 6, 0, Math.PI * 2);
            ctx.fill();

            if (right && paddleX < canvas.width - 80) paddleX += 5;
            if (left && paddleX > 0) paddleX -= 5;

            ballX += ballDX;
            ballY += ballDY;

            if (ballX <= 0 || ballX >= canvas.width) ballDX *= -1;
            if (ballY <= 0) ballDY *= -1;

            // colisão com a raquete
            if (ballY <= paddleY + 10 && ballX >= paddleX && ballX <= paddleX + 80) {
                ballDY *= -1;
            }

            // se perder
            if (ballY > canvas.height) {
                ws.current.send(JSON.stringify({ type: 'lose' }));
            }

            requestAnimationFrame(draw);
        };

        const handleKey = (e) => {
            if (e.key === 'ArrowLeft') left = e.type === 'keydown';
            if (e.key === 'ArrowRight') right = e.type === 'keydown';
        };

        document.addEventListener('keydown', handleKey);
        document.addEventListener('keyup', handleKey);
        draw();

        return () => {
            document.removeEventListener('keydown', handleKey);
            document.removeEventListener('keyup', handleKey);
        };
    }, [players, name]);

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
                        {!players.includes(name) && queue.slice(0, 2).includes(name) && (
                            <p style={{ color: 'white', textAlign: 'center' }}>
                                Pressione espaço para iniciar o jogo
                            </p>
                        )}
                        <canvas ref={canvasRef}/>
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
