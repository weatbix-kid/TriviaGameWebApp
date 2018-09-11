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

// var RoomProps = function(_name){
//     this.name = _name,
//     this.connectedSockets = getConnectedSockets(this.name),
//     this.state = 'lobby',
//     this.round = null,
//     this.roundNumber = 0,
//     this.refresh = function(){
//         this.connectedSockets = getConnectedSockets(this.name)
//     }
// };

class RoomProps {
    constructor(name){
        this._name = name;
        this._connectedSockets = getConnectedSockets(name);
        this._state = 'lobby';
        this._round = null;
        this._roundNumber = 0;
    }

    refresh(){
        this._connectedSockets = getConnectedSockets(this.name);
    }

    incrementRoundNum(){
        this._roundNumber++;
    }

    set state(newState){ this._state = newState; }
    set round(newRound){ this._round = newRound; }
    set roundNumber(number){ this._roundNumber = number; }

    get state(){ return this._state; }
    get round(){ return this._round; }
    get roundNumber(){ return this._roundNumber }
};

class Round {
    constructor(question, answers, correctAnswer){
        this._question = question;
        this._answers = answers;
        this._correctAnswer = correctAnswer;
    }

    get question(){ return this._question; }
    get answers(){ return this._answers; }
    get correctAnswer(){ return this._correctAnswer }
}

RoomTimers = [];
Rooms = [null, null, null, null];

// Socket.io connections
socket.on('connection', function(clientSocket){
    clientSocket.currentRoom = null;
    clientSocket.readyStatus = false;
    clientSocket.score = 0;

    clientSocket.on('requestRoom', function(selectedRoom, joinedRoom){
        let selectedRoomIndex = selectedRoom.charAt(1);
        // If the room doesnt already exist
        if (!socket.sockets.adapter.rooms[selectedRoom]){
            // Create and join the room
            clientSocket.join(selectedRoom);
            clientSocket.currentRoom = selectedRoom;
            joinedRoom(true);
            Rooms.splice(selectedRoomIndex, 1, new RoomProps(selectedRoom));
            console.log('A user created and joined room ' + selectedRoom)
            socket.to(selectedRoom).emit('playersInRoom', returnRoomsPlayerCount());
            socket.to(selectedRoom).emit('totalPlayersReady', returnTotalPlayersReady(selectedRoom));
        }
        else {
            // If the room exists
            console.log('A user requested to join room ' + selectedRoom)

            // Check wether there is space in the room and that it is not in progress
            // Eventaully will use Room obj
            // if(Rooms[selectedRoomIndex].connectedSockets.length <= 3 && Rooms[selectedRoomIndex].state != 'in-game'){
            if (socket.sockets.adapter.rooms[selectedRoom].length <= 3 && Rooms[selectedRoomIndex].state != 'in-game'){
                clientSocket.join(selectedRoom);
                clientSocket.currentRoom = selectedRoom;
                joinedRoom(true);
                Rooms[selectedRoomIndex].refresh();
                socket.to(selectedRoom).emit('playersInRoom', returnRoomsPlayerCount());
                socket.to(selectedRoom).emit('totalPlayersReady', returnTotalPlayersReady(selectedRoom));
            }
            else {
                console.log('User tryed to join ' + selectedRoom + ' but its full or already in-game')
                joinedRoom(false);
            }
        }
    });

    clientSocket.on('refreshRooms', function(data){
        // Return player room lengths via callback
        data(returnRoomsPlayerCount(), returnActiveGames());
    });

    clientSocket.on('toggleReadyStatus', function(){
        // Toggle socket ready status for current player
        if(clientSocket.readyStatus == false)
            clientSocket.readyStatus = true;
        else
            clientSocket.readyStatus = false;

        // Decide Wether to start game in 5s or notify player counts
        let playersInRoom = returnTotalPlayersReady(clientSocket.currentRoom);
        let selectedRoomIndex = clientSocket.currentRoom.charAt(1);
        // Checks if ready players = total players 
        if (playersInRoom[0] === playersInRoom[1]){
            console.log('All players are ready!');
            socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
            socket.to(clientSocket.currentRoom).emit('notifyGameState', 'Game Commencing in 5s');

            // Creates a new 5 second timer for a specific room (index)  
            // RoomTimers.splice(clientSocket.currentRoom[1], 1, setTimeout(function(){
            console.log('Started ready timer for room ' + selectedRoomIndex)
            RoomTimers.splice(selectedRoomIndex, 1, setTimeout(function(){  
                console.log('Commencing game! /n ' + Rooms[selectedRoomIndex].state + '/n '+ Rooms[selectedRoomIndex].round + '/n '+ Rooms[selectedRoomIndex].roundNumber)

                var newRound = new Round('Is this a placeholder question?', ['Yes', 'No', 'Maybe', 'I Dont Know'], 2);
                Rooms[selectedRoomIndex].state = 'in-game';
                Rooms[selectedRoomIndex].round = newRound;
                Rooms[selectedRoomIndex].incrementRoundNum();
                console.log('New stuff! /n ' + Rooms[selectedRoomIndex].state + '/n '+ Rooms[selectedRoomIndex].round + '/n '+ Rooms[selectedRoomIndex].roundNumber)
                socket.to(clientSocket.currentRoom).emit('startGame', newRound);  

                console.log('Started round timer for room ' + selectedRoomIndex)
                // Player answer timer
                RoomTimers.splice(selectedRoomIndex, 1, setTimeout(function(){  
                    console.log(selectedRoomIndex + ' timed out!')
                    socket.to(clientSocket.currentRoom).emit('newRound', newRound);  
                }, 15000));
            }, 5000));

        }
        else {
            console.log('Canceling ready timer for room ' + selectedRoomIndex)
            socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
            socket.to(clientSocket.currentRoom).emit('notifyGameState');
            // Stop timer for specific room

            // Stops the 5 second timer if readyplayers != total players
            clearTimeout(RoomTimers[selectedRoomIndex]);
        }
    });

    clientSocket.on('roundResponse', function(clientResponse, callback){
        let selectedRoomIndex = clientSocket.currentRoom.charAt(1);
        let answer = clientResponse.charAt(1);

        console.log('Recieved response from ' + clientSocket.currentRoom + ': ' + answer);
        var currentRound = Rooms[selectedRoomIndex].round;
        if(currentRound.correctAnswer == answer){
            console.log('Correct!')
            clientSocket.score++;
            console.log(clientSocket.score);
        }
        else{
            // console.log('Incorrect!!')
        }
        callback(true);
    });

    clientSocket.on('leaveRoom',function(){
        // If client was in a room update changes
        if(clientSocket.currentRoom != null){
            clientSocket.leave(clientSocket.currentRoom);
            socket.to(clientSocket.currentRoom).emit('playersInRoom', returnRoomsPlayerCount());
            socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
            Rooms[clientSocket.currentRoom.charAt(1)].refresh();
        }

        // Reset the client socket's properties
        clientSocket.currentRoom = null;
        clientSocket.readyStatus = false;
        clientSocket.score = 0;
    });

    clientSocket.on('disconnect', function(){
        // If client was in a room update changes
        if(clientSocket.currentRoom != null){
            clientSocket.leave(clientSocket.currentRoom);
            socket.to(clientSocket.currentRoom).emit('playersInRoom', returnRoomsPlayerCount());
            socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
            Rooms[clientSocket.currentRoom.charAt(1)].refresh();
        }
    });
});

function returnRoomsPlayerCount() {
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
        for (let player of players) {
            if(player.readyStatus == true)
                playersReady.push(player.readyStatus);
        }
    }
    return([playersReady.length, players.length]);
}

function returnActiveGames(){
    let activeRooms = [false, false, false, false];
    let i = -1;
    for (let Room of Rooms) {
        i++
        // If the current index is a room check its state
        if(Room != null) {
            if(Room.state === 'in-game')
            activeRooms.splice(i, 1, true);
        }
    }
    return(activeRooms);
}

function getConnectedSockets(roomName) {
    let connectedSockets = [];
    
    // If the room exists
    if(socket.sockets.adapter.rooms[roomName]){
        let roomObj = socket.sockets.adapter.rooms[roomName].sockets;

        // For each socket id in the room
        for (let id of Object.keys(roomObj)) {
            // Add player id to players array
            connectedSockets.push(socket.sockets.connected[id]);
        }
    }
    return(connectedSockets);
}

// Start the server
server.listen(3000, function(){
    console.log('server listening on *:3000')
});