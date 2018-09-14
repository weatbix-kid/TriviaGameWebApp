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

class RoomProps {
    constructor(name){
        this._name = name;
        this._state = 'lobby';
        this._round = null;
        this._roundNumber = 0;
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

RoomTimers = [null, null, null, null];
Rooms = [null, null, null, null];
TestTimer = null;

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
            if (socket.sockets.adapter.rooms[selectedRoom].length <= 3 && Rooms[selectedRoomIndex].state != 'in-game'){
                clientSocket.join(selectedRoom);
                clientSocket.currentRoom = selectedRoom;
                joinedRoom(true);
                // Rooms[selectedRoomIndex].refresh();
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
            console.log('Started ready timer for room ' + selectedRoomIndex)
            RoomTimers.splice(selectedRoomIndex, 1, setTimeout(function(){
                console.log('Game Started');
                console.log('Initating game loop');
                Rooms[selectedRoomIndex].state = 'in-game';
                socket.to(clientSocket.currentRoom).emit('startGame'); 
                RoomTimers.splice(selectedRoomIndex, 1, setInterval(initiateGameLoop, 10000));
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

    function initiateGameLoop(){
        let selectedRoomIndex = clientSocket.currentRoom.charAt(1);
        console.log('initiate game loop index: ' + selectedRoomIndex)

        console.log('---');
        console.log('Emit show result/wait room'); 
        socket.to(clientSocket.currentRoom).emit('showResults', returnPlayerScores(clientSocket.currentRoom));
        console.log('emitting new round in 5');
        TestTimer = setTimeout(function(){ 
            if(Rooms[selectedRoomIndex].roundNumber <= 1){ // 3 means 4 rounds
                var newRound = new Round('Is this a placeholder question?', ['Yes', 'No', 'Maybe', 'I Dont Know'], 2);
                // Rooms[selectedRoomIndex].state = 'in-game';
                Rooms[selectedRoomIndex].round = newRound;
                Rooms[selectedRoomIndex].incrementRoundNum();
                console.log('New stuff! /n ' + Rooms[selectedRoomIndex].state + '/n '+ Rooms[selectedRoomIndex].round + '/n '+ Rooms[selectedRoomIndex].roundNumber)
                socket.to(clientSocket.currentRoom).emit('newRound', newRound);  
            }
            else {
                // Stop all timers
                clearInterval(RoomTimers[selectedRoomIndex]); // Works now what??

                console.log('Game ended');
                socket.to(clientSocket.currentRoom).emit('endGame', returnPlayerScores(clientSocket.currentRoom));

                // kick all the players from the room and reset all their individual props
                kickPlayers(clientSocket.currentRoom);
                Rooms[selectedRoomIndex].state = 'lobby';
            }
        }, 5000)
    }

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
        leaveNotifyRoom();
        // Reset the client socket's properties
        clientSocket.currentRoom = null;
        clientSocket.readyStatus = false;
        clientSocket.score = 0;
    });

    clientSocket.on('disconnect', function(){
        // If client was in a room update changes
        leaveNotifyRoom();
    });

    // This function lives here because it directly uses a client property
    function leaveNotifyRoom(){
        if(clientSocket.currentRoom != null){
            clientSocket.leave(clientSocket.currentRoom);
            socket.to(clientSocket.currentRoom).emit('playersInRoom', returnRoomsPlayerCount());
            socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
        }
    }

    // Could probably move this
    function kickPlayers(roomName) {
        let players = [];
    
        // If the room exists
        if(socket.sockets.adapter.rooms[roomName]){
            let roomObj = socket.sockets.adapter.rooms[roomName].sockets;
    
            // For each socket id in the room
            for (let id of Object.keys(roomObj)) {
                // Add player id to players array
                players.push(socket.sockets.connected[id]);
            }
    
            // For each player in players change their socket properties
            for (let player of players) {
                let currentRoomConnection = player.currentRoom;
                player.leave(currentRoomConnection);
                player.currentRoom = null;
                player.readyStatus = false;
                player.score = 0;
            }
        }
    }
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

function returnPlayerScores(roomName) {
    let players = [];
    let scores = {};
    
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
            // Add to dictionary 
            // console.log(player.id + ': ' + player.score);
            scores[player.id] = player.score;
        }
    }
    return(scores);
}

// Start the server
server.listen(3000, function(){
    console.log('server listening on *:3000')
});