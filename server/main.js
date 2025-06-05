const WebSocket = require('ws');
const wss = new WebSocket.Server({port: 3000});

let queue = [];
let players = []; // até 2 jogadores jogando
let chatMessages = [];

function broadcast(type, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type: type, content: data}));
        }
    });
}

export class Msg {
    constructor(from, text) {
        this.createdAt = new Date()
        this.text = text
        this.from = from
    }
}

wss.on('connection', ws => {
    let playerName = null;

    ws.on('message', message => {
        // console.log(message.toString())
        const data = JSON.parse(message);

        switch (data.type) {
            case 'join':
                playerName = data.name;
                queue.push(playerName);
                chatMessages.push(new Msg('system', `${playerName} entrou.`))
                updateState();
                break;

            case 'chat':
                chatMessages.push(new Msg(playerName, data.text));
                broadcast('chat', chatMessages);
                break;

            case 'startGame':
                if (players.length < 2 && queue[0] === playerName) {
                    players.push(playerName);
                    chatMessages.push(new Msg('system', `${playerName} entrou no jogo.`))
                }
                updateState();
                break;

            case 'lose':
                const index = players.indexOf(playerName);
                if (index > -1) {
                    players.splice(index, 1);
                    queue.push(playerName);
                    chatMessages.push(new Msg('system', `${playerName} perdeu e voltou para a fila.`))
                    updateState();
                }
                break;
        }
    });

    ws.on('close', () => {
        if (playerName) {
            // remover da fila e jogadores se necessário
            queue = queue.filter((p) => (p) !== playerName);
            players = players.filter((p) => p !== playerName);
            chatMessages.forEach((msg) => {
                if (msg.from === playerName) {
                    msg.from = msg.from + " (saiu)"
                }
            })
            chatMessages.push(new Msg('system', `${playerName} saiu.`))
            updateState();
        }
    });

    function updateState() {
        broadcast('state', {players, queue, chatMessages});
    }

    updateState();
});
