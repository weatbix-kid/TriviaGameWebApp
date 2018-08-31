// Set up requirements
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var socket = require('socket.io')(server);

// Define folders used to serve static files
    app.use(express.static('public'));
    app.use(express.static(__dirname + '/node_modules/jquery'));

// Define a default route
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

// Socket.io connections
socket.on('connection', function(clientSocket){
    clientSocket.currentRoom = null;
    clientSocket.readyStatus = false;

    clientSocket.on('requestRoom', function(selectedRoom, joinedRoom){
        // If the room doesnt already exist
        if (!socket.sockets.adapter.rooms[selectedRoom]){
            // Create and join the room
            clientSocket.join(selectedRoom);
            clientSocket.currentRoom = selectedRoom;
            joinedRoom(true);
            console.log('A user created and joined room ' + selectedRoom)
            socket.to(selectedRoom).emit('playersInRoom', returnRoomPlayerCount());
            socket.to(selectedRoom).emit('totalPlayersReady', returnTotalPlayersReady(selectedRoom));
        }
        else {
            // If the room exists
            console.log('A user requested to join room ' + selectedRoom)

            // Check for space
            if (socket.sockets.adapter.rooms[selectedRoom].length <= 3 ){
                clientSocket.join(selectedRoom);
                clientSocket.currentRoom = selectedRoom;
                joinedRoom(true);
                socket.to(selectedRoom).emit('playersInRoom', returnRoomPlayerCount());
                socket.to(selectedRoom).emit('totalPlayersReady', returnTotalPlayersReady(selectedRoom));
            }
            else {
                console.log('User tryed to join ' + selectedRoom + ' but its full')
                joinedRoom(false);
            }
        }
    });

    clientSocket.on('toggleReadyStatus', function(){
        // Toggle socket ready status for current player
        if(clientSocket.readyStatus == false)
            clientSocket.readyStatus = true;
        else
            clientSocket.readyStatus = false;

        // Notify total amount of players ready in the sockets room
        socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
    });

    clientSocket.on('leaveRoom',function(){
        // Leave the room and notify the room of multiple changes
        clientSocket.leave(clientSocket.currentRoom);
        socket.to(clientSocket.currentRoom).emit('playersInRoom', returnRoomPlayerCount());
        socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));

        // Reset the sockets properties
        clientSocket.currentRoom = null;
        clientSocket.readyStatus = false;
    });

    clientSocket.on('refreshRooms', function(data){
        // Return player room lengths via callback
        data(returnRoomPlayerCount());
    });

    clientSocket.on('disconnect', function(){
        // Leave the room and notify the room of multiple changes
        clientSocket.leave(clientSocket.currentRoom);
        socket.to(clientSocket.currentRoom).emit('playersInRoom', returnRoomPlayerCount());
        socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
    });
});

function returnRoomPlayerCount() {
    let roomsDictObj = socket.sockets.adapter.rooms;
    let totalRooms = Object.keys(roomsDictObj).length;
    let individualRoomPlayerCounts = [0, 0, 0, 0];

    // Do atleast 5 loops otherwise do the amount of total rooms
    for (let i = 0; i <= 3 || i <= totalRooms; i++) {
        // If room exists
        if(socket.sockets.adapter.rooms['R' + i]){
            // Replace the current index with the room length
            individualRoomPlayerCounts.splice(i, 1, socket.sockets.adapter.rooms['R' + i].length);
        }
    }
    return(individualRoomPlayerCounts);
}

function returnTotalPlayersReady(roomName) {
    let players = [];
    let playersReady = [];
    
    // If the room exists
    if(socket.sockets.adapter.rooms[roomName]){
        let roomObj = socket.sockets.adapter.rooms[roomName].sockets;

        // For each socket id in the room
        for (let id of Object.keys(roomObj)) {
            // Add player id to players array
            players.push(socket.sockets.connected[id]);
        }

        // For each player check readyStatus
        console.log('Ready status of players in ' + roomName + ':');
        for (let player of players) {
            console.log(player.id + ': ' + player.readyStatus);
            if(player.readyStatus == true)
                playersReady.push(player.readyStatus);
        }
    }
    return(playersReady.length +'/' + players.length + ' players are ready');
}

// Start the server
server.listen(3000, function(){
    console.log('server listening on *:3000')
});