import {getRandomVelocity} from "./utils";

const WebSocket = require('ws');
const wss = new WebSocket.Server({port: 1110});

let queue = [];
let chatMessages = [];

function broadcast(type, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type, content: data}));
        }
    });
}

export class Game {
    constructor(ball, ) {

    }
}

export class Msg {
    constructor(from, text) {
        this.createdAt = new Date()
        this.text = text
        this.from = from
    }
}

export class Control {
    constructor(from, control) {
        this.createdAt = new Date()
        this.control = control
        this.from = from
    }
}

export class Player {
    constructor(name, done, point) {
        this.name = name
        this.point = point
        this.done = done
    }
}


wss.on('connection', ws => {
    let player = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        // console.log(message.toString())

        switch (data.type) {
            case 'join':
                player = new Player(data.name, false, 0);
                queue.push(player);
                chatMessages.push(new Msg('system', `${player.name} entrou.`))
                updateState();
                break;

            case 'chat':
                chatMessages.push(new Msg(player.name, data.text));
                broadcast('chat', chatMessages, ws);
                break;

            case 'startGame':
                const i0 = queue.map((p) => p.name).indexOf(data.text);
                if (i0 > -1 && i0 === 1 || i0 === 0) {
                    if(queue[i0].done) {
                        return
                    }
                    queue[i0].done = true
                    queue[i0].inGame = true
                    chatMessages.push(new Msg('system', `${player.name} está pronto.`))
                    updateState();
                    if(queue[0].done && queue[1].done) {
                        broadcast("game", new StartBallContext())
                    }
                }
                break;

            case 'point':
                const i1 = queue.map((p) => p.name).indexOf(data.text);
                queue[i1].point++
                if(queue[i1].point === 4) {
                    queue.splice(i1, 1);
                    player.done = false
                    queue.push(player);
                    chatMessages.push(new Msg('system', `${player.name} perdeu e voltou para o final da fila.`))
                    updateState();
                }
                broadcast("game", new StartBallContext())
                break;

            case 'playerControl':
                broadcast('control', new Control(player.name, data.text));
                break;
        }
    });

    ws.on('close', () => {
        if (player == null) {
            return
        }

        const i0 = queue.map((p) => p.name).indexOf(data.text);
        if (i0 > -1 && i0 === 1 || i0 === 0) {
            broadcast("stop", {})
        }

        queue = queue.filter((p) => p.name !== player.name);
        chatMessages.forEach((msg) => {
            if (msg.from === player.name) {
                msg.from = msg.from + " (saiu)"
            }
        })
        chatMessages.push(new Msg('system', `${player.name} saiu.`))
        updateState();
    });

    function updateState() {
        broadcast('state', {queue, chatMessages}, ws);
    }

    updateState();
});
