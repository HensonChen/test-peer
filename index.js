const express = require('express');
const http = require('http');
const path = require('path');
const ws = require('ws');
const uuid = require('uuid');
// const socket = require('socket.io');

const app = express();
app.use('/static', express.static(`${__dirname}/static`));
app.locals.connections = [];

const server = http.createServer(app);
const wss = new ws.Server({ server });

// socket.io connection
// const io = socket(server);
// const users = {}

// io.on('connection', socket => {
//     if (!users[socket.id]) user[socket.id] = socket.id;
//     socket.emit('selfId', socket.id);
//     io.sockets.emit('allUsers', Object.values(users));

//     socket.on('callUser', (data) => {
//         io.to(data.to).emit('hello', {signal: data.signalData, from: data.from});
//     });

//     socket.on('disconnect', () => {
//         delete users[socket.id];
//         socket.broadcast.emit('allUsers', users);
//     });

//     socket.on('message', (data) => {
//         socket.broadcast.emit('message', data);
//     });

// });

function broadcastConnections() {
    let ids = app.locals.connections.map(c => c._connId);
    app.locals.connections.forEach(c => {
        c.send(JSON.stringify({ type: 'ids', ids }));
    });
}

wss.on('connection', (ws) => {
    app.locals.connections.push(ws);
    ws._connId = `conn-${uuid.v4()}`;

    // send the local id for the connection
    ws.send(JSON.stringify({ type: 'connection', id: ws._connId }));

    // send the list of connection ids
    broadcastConnections();

    ws.on('close', () => {
        let index = app.locals.connections.indexOf(ws);
        app.locals.connections.splice(index, 1);

        // send the list of connection ids
        broadcastConnections();
    });

    ws.on('message', (message) => {
        for (let i = 0; i < app.locals.connections.length; i++) {
            if (app.locals.connections[i] !== ws) {
                app.locals.connections[i].send(message);
            }
        }
    });

});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static/index.html'));
});

server.listen(process.env.PORT || 8081, () => {
    console.log(`Started server on port ${server.address().port}`);
});