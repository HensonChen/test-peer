const express = require('express');
const http = require('http');
const path = require('path');
const ws = require('ws');
const uuid = require('uuid');
const socketio = require('socket.io');

const app = express();
app.use('/static', express.static(`${__dirname}/static`));
// app.locals.connections = [];

const server = http.createServer(app);
// const wss = new ws.Server({ server });

// establish socket.io connection
const io = socketio(server);
const roomUsers = {}

function isAuth(token) {
    // TODO: user authentication
    return true;
}

io.use((socket, next) => {
    if (!isAuth(socket.handshake.auth.token)) return next(new Error("Permission denied!"));
    next();
}).on('connection', socket => {
    let roomId = socket.handshake.query.roomId;
    socket.join(roomId);
    if (!roomUsers[roomId]) roomUsers[roomId] = {};
    if (!roomUsers[roomId][socket.id]) roomUsers[roomId][socket.id] = socket.id;
    
    console.log(roomUsers);
    
    socket.emit('init', { selfId: socket.id, allUserIds: Object.values(roomUsers[roomId]) });
    // update all users
    socket.to(roomId).emit('allUserIds', Object.values(roomUsers[roomId]));

    socket.on('notifyPeers', (data) => {
        socket.to(data.to).emit('hello', { signalData: data.signalData, initiatorId: data.from });
    });

    socket.on('acceptConn', (data) => {
        socket.to(data.to).emit('accepted', { targetId: socket.id, signalData: data.signalData });
    });

    socket.on('disconnect', () => {
        delete roomUsers[roomId][socket.id];
        socket.leave(roomId);
        socket.to(roomId).emit('allUserIds', Object.values(roomUsers[roomId]));
    });

    // socket.on('message', (data) => {
    //     socket.to(roomId).emit('message', data);
    // });

});

// function broadcastConnections() {
//     let ids = app.locals.connections.map(c => c._connId);
//     app.locals.connections.forEach(c => {
//         c.send(JSON.stringify({ type: 'ids', ids }));
//     });
// }

// wss.on('connection', (ws) => {
//     app.locals.connections.push(ws);
//     ws._connId = `conn-${uuid.v4()}`;

//     // send the local id for the connection
//     ws.send(JSON.stringify({ type: 'connection', id: ws._connId }));

//     // send the list of connection ids
//     broadcastConnections();

//     ws.on('close', () => {
//         let index = app.locals.connections.indexOf(ws);
//         app.locals.connections.splice(index, 1);

//         // send the list of connection ids
//         broadcastConnections();
//     });

//     ws.on('message', (message) => {
//         for (let i = 0; i < app.locals.connections.length; i++) {
//             if (app.locals.connections[i] !== ws) {
//                 app.locals.connections[i].send(message);
//             }
//         }
//     });

// });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'static/index.html'));
});

server.listen(process.env.PORT || 8081, () => {
    console.log(`Started server on port ${server.address().port}`);
});