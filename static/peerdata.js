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
socket.on('init', (data) => {
    selfSocketId = data.selfId;
    allSocketIds = data.allUserIds;
    connectPeers();
});

// keep all connected user id updated and establish simple-peer connection to them
socket.on('allUserIds', (users) => {
    console.log("new user");
    allSocketIds = users;
});

// signal the data passed by peer
socket.on('hello', (data) => {
    signal(data.initiatorId, data.signalData);
});

function callPeer(index) {
    if (index >= allSocketIds.length) return;
    let id = allSocketIds[index];
    // return if connect to self or already connected
    if (id === selfSocketId || peerConnections[id]) return;
    let peer = new SimplePeer({
        initiator: true,
        trickle: false
    });

    peer.on('signal', signalData => {
        socket.emit("notifyPeers", { to: id, signalData: signalData, from: selfSocketId })
    })
    peer.on('error', console.error);
    peer.on('connect', () => {
        console.log(selfSocketId + " successfully connected to " + id);
        callPeer(index+1);
    });
    peer.on('data', (data) => {
        onPeerData(id, data);
    });

    // finalize connection if connection accepted
    socket.on('accepted', data => {
        // peer.signal(signalData);
        // peerConnections[id] = peer;
        if (data.targetId === id) {
            // console.log("accepted by ", data.signalData);
            try {
                peer.signal(data.signalData);
                peerConnections[id] = peer;
            } catch (error) {
                console.log(error);
            }
        }
    });
}

function connectPeers() {
    // destroy p2p connection to disconnected user
    Object.keys(peerConnections).forEach(id => {
        if (!allSocketIds.includes(id)) {
            peerConnections[id].destroy();
            delete peerConnections[id];
        }
    });
    // establish new p2p connection
    callPeer(0);
}

function signal(initiator, initiatorData) {
    console.log("Running signal");
    let peer = new SimplePeer({
        initiator: false,
        trickle: false
    });
    peer.on('signal', signalData => {
        socket.emit("acceptConn", { signalData: signalData, to: initiator })
    });
    peer.on('data', (data) => {
        onPeerData(initiator, data);
    });
    peer.signal(initiatorData);
    peerConnections[initiator] = peer;
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