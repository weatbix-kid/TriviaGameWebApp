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
    clientSocket.on('requestRoom', function(selectedRoom, joinedRoom){
        // If the room doesnt already exist
        if (!socket.sockets.adapter.rooms[selectedRoom]){
            // Create and join the room
            clientSocket.join(selectedRoom);
            clientSocket.currentRoom = selectedRoom;
            console.log(clientSocket.currentRoom);
            joinedRoom(true);
            console.log('A user created and joined room ' + selectedRoom)
            socket.to(selectedRoom).emit('playersInRoom', returnRoomPlayerCount());
        }
        else {
            // If the room exists
            console.log('A user requested to join room ' + selectedRoom)

            // Check for space
            if (socket.sockets.adapter.rooms[selectedRoom].length <= 3 ){
                clientSocket.join(selectedRoom);
                clientSocket.currentRoom = selectedRoom;
                console.log(clientSocket.currentRoom);
                joinedRoom(true);
                socket.to(selectedRoom).emit('playersInRoom', returnRoomPlayerCount());
            }
            else {
                console.log('User tryed to join ' + selectedRoom + ' but its full')
                joinedRoom(false);
            }
        }
    });

    clientSocket.on('leaveRoom',function(){
        console.log('Player leaving ' + clientSocket.currentRoom);
        clientSocket.leave(clientSocket.currentRoom);
        console.log('leaving ' + clientSocket.currentRoom);
        socket.to(clientSocket.currentRoom).emit('playersInRoom', returnRoomPlayerCount());
        clientSocket.currentRoom = null;
        console.log('Player left, currentRoom: ' + clientSocket.currentRoom);
    })

    clientSocket.on('refreshRooms', function(data){
        // Return player room lengths via callback
        data(returnRoomPlayerCount());
    });

    clientSocket.on('disconnect', function(){
        clientSocket.leave(clientSocket.currentRoom);
        socket.to(clientSocket.currentRoom).emit('playersInRoom', returnRoomPlayerCount());
    })
});

function returnRoomPlayerCount() {
    var roomsDict = socket.sockets.adapter.rooms;
    var totalRooms = Object.keys(roomsDict).length;
    var individualRoomPlayerCounts = [0, 0, 0, 0];

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

// Start the server
server.listen(3000, function(){
    console.log('server listening on *:3000')
});