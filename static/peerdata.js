// import { io } from "socket.io-client";
// import Peer from "simple-peer";
let roomId = "000000";
let token = "abc";
let selfSocketId;
let allSocketIds;
let peerConnections = {};   // { socketId : peerConnection }

// connect the server by passing in auth token and roomId
const socket = io('/', {
    auth: {
        token: token
    },
    query: {
        "roomId": roomId
    }
});

// receive self socket id when connected to the server
socket.on('selfId', (id) => {
    selfSocketId = id;
});

// keep all connected user id updated and establish simple-peer connection to them
socket.on('allUserIds', (users) => {
    allSocketIds = users;
    connectPeers();
});

// signal the data passed by peer
socket.on('hello', (data) => {
    signal(data.initiatorId, data.signalData);
});

function connectPeers() {
    // destroy p2p connection to disconnected user
    Object.keys(peerConnections).forEach(id => {
        if (!allSocketIds.includes(id)) {
            peerConnections[id].destroy();
            delete peerConnections[id];
        }
    });
    // establish new p2p connection
    allSocketIds.forEach( id => {
        // return if connect to self or already connected
        if (id === selfSocketId || peerConnections[id]) return;
        const peer = new SimplePeer({
            initiator: true,
            trickle: false
        });

        peer.on('signal', signalData => {
            socket.emit("notifyPeers", { to: id, signalData: signalData, from: selfSocketId })
        })
        peer.on('error', console.error);
        peer.on('connect', () => {
            console.log(selfSocketId + " successfully connected to " + id);
        });
        peer.on('data', (data) => {
            onPeerData(id, data);
        });

        peerConnections[id] = peer;
    
        // finalize connection if connection accepted
        socket.on('accepted', signalData => {
            peer.signal(signalData);
        });
    });
}

function signal(initiator, initiatorData) {
    const peer = new SimplePeer({
        initiator: false,
        trickle: false
    });
    peer.on('signal', signalData => {
        socket.emit("acceptConn", { signalData: signalData, to: initiator })
    });
    peer.signal(initiatorData);
}

function peerBroadcast(data) {
    Object.values(peerConnections).forEach(peer => {
        try {
            peer.send(data)
        } catch (err) {
            console.error(err);
        }
    });
}