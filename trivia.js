// Load environment variables 
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').load();
}

// Set up requirements
const fs = require('fs');
var request = require('request');
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var socket = require('socket.io')(server);

const Round = require('./server/js/classes/Round.js');
const Room = require('./server/js/classes/Room.js');

const path = './server/wordlist_avn_m.txt';

// Define folders used to serve static files
    app.use(express.static('public'));
    app.use(express.static(__dirname + '/node_modules/jquery'));

// Define a default route
app.get('/', function(req, res){
    res.sendFile(__dirname + '/views/index.html');
});

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
            Rooms.splice(selectedRoomIndex, 1, new Room(selectedRoom));
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
                RoomTimers.splice(selectedRoomIndex, 1, setInterval(initiateGameLoop, 20000));
            }, 5000));
        }
        else {
            console.log('Canceling ready timer for room ' + selectedRoomIndex)
            socket.to(clientSocket.currentRoom).emit('totalPlayersReady', returnTotalPlayersReady(clientSocket.currentRoom));
            socket.to(clientSocket.currentRoom).emit('notifyGameState');

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
            if(Rooms[selectedRoomIndex].roundNumber <= 4){ // 5 rounds
                createNewRound(function(returnValue){
                    if (returnValue != null){
                        Rooms[selectedRoomIndex].round = returnValue;
                        Rooms[selectedRoomIndex].incrementRoundNum();
                        console.log(Rooms[selectedRoomIndex].name + ': Round ' +Rooms[selectedRoomIndex].roundNumber)
                        socket.to(clientSocket.currentRoom).emit('newRound', returnValue);  
                    }
                    else{
                        console.log('round was null') // This shouldnt have to happen
                    }
                    
                });
            }
            else {
                // Stop all timers
                clearInterval(RoomTimers[selectedRoomIndex]); // Works now what??

                // Emit end game event
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
        let currentRound = Rooms[selectedRoomIndex].round;

        // Check the clients response against the correct answer 
        if(currentRound.correctAnswer == answer)
            clientSocket.score++;
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

    // Responsible for requesting and consuming data from the Oxford Dictionary API
    function createNewRound(callback){
        let randomIndex = Math.floor((Math.random() * wordlist.length) + 0);
        let randomWord = wordlist[randomIndex];
        console.log('Index: ' + randomIndex + ' Word: ' + randomWord);
    
        // Request URL for definition of random word
        var url1 = {
            url: 'https://od-api.oxforddictionaries.com:443/api/v1/entries/en/' + randomWord.toLowerCase(),
            headers: {
              'app_id': process.env.OD_API_ID,
              'app_key': process.env.OD_API_KEY
            }
        };
    
        // Request URL for synonyms of random word
        var url2 = {
            url: 'https://od-api.oxforddictionaries.com:443/api/v1/entries/en/' + randomWord.toLowerCase() + '/synonyms',
            headers: {
                'app_id': process.env.OD_API_ID,
                'app_key': process.env.OD_API_KEY
            }
        };

        // Request for definition
        request(url1, (error, response, body) => {
            // If the response is successful
            if (!error && response.statusCode == 200) {
                var info = JSON.parse(body);

                let question = '';
                let example = '';

                try {
                    question = info.results[0].lexicalEntries[0].entries[0].senses[0].definitions[0];
                } catch (error) {
                    console.log(error + '\n' + randomWord + ' is a shit word and must be purged as it doesnt have a definition')
                    callback(null);
                }
                
                try {
                    example = info.results[0].lexicalEntries[0].entries[0].senses[0].examples[0].text;
                } catch (error) {
                    console.log(err);
                    console.log('No example, couldnt make hint')
                    example = '';
                }
                
                let possibleAnswers = [];
                let regex = new RegExp(randomWord,'gi');
                let hint = example.replace(regex, '___');

                console.log('----------------')
                console.log('Definition: ' + question + '\n' + 'Hint: ' + hint);

                // Request for synonyms
                request(url2, (error, response, body) => {
                    if (!error && response.statusCode == 200) {
                        var info = JSON.parse(body);
            
                        let synonyms = info.results[0].lexicalEntries[0].entries[0].senses[0].synonyms

                        // For each synonym
                        for (let index = 0; index < synonyms.length; index++) {
                            isBad = false; 
                            // Check the word for spaces, hyphens and commas
                            for (let char = 0; char < synonyms[index].text.length; char++) {
                                if (synonyms[index].text[char] == ' ' || synonyms[index].text[char] == '-' || synonyms[index].text[char] == ','){
                                    isBad = true;
                                    break;
                                }
                            }
                            // If the word is acceptable add it as a possible answer until there are 3
                            if (!isBad && possibleAnswers.length <= 2){
                                possibleAnswers.push(synonyms[index].text)
                            }   
                        }
            
                        // If we dont have enough answers randomly select some more until we have 3
                        if (possibleAnswers.length <= 2){
                            console.log('Still need more answers')
                            while (possibleAnswers.length <= 2) {
                                let r = Math.floor((Math.random() * wordlist.length))
                                console.log(wordlist[r]);
                                possibleAnswers.push(wordlist[r]);
                            }
                        }
                        else {
                            console.log('Has enough answers')
                        }
                        
                        possibleAnswers.push(randomWord);
        
                        var answers = shuffleAnswers(possibleAnswers);

                        console.log('shuffled answers: ' + answers);
                        console.log('----------------')

                        // Serve the round
                        var newRound = new Round(question, hint , possibleAnswers, possibleAnswers.indexOf(randomWord));
                        // console.log(newRound);
                        callback(newRound);
                    }
                    else {
                        console.log('Word has no synonyms, getting random answers');

                        if (possibleAnswers.length <= 2){
                            console.log('Still need more answers')
                            while (possibleAnswers.length <= 2) {
                                let r = Math.floor((Math.random() * wordlist.length))
                                console.log(wordlist[r]);
                                possibleAnswers.push(wordlist[r]);
                            }
                        }

                        possibleAnswers.push(randomWord);

                        // createNewRound();
                        var newRound = new Round(question, hint , possibleAnswers, possibleAnswers.indexOf(randomWord));
                        callback(newRound);
                    }
                });
            }
            else {
                // createNewRound();
                console.log(error);
                console.log(randomWord);
                callback(null); // We should never reach this point but if we do return null so it doesnt crash
            }
        });
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
            scores[player.id] = player.score;
        }
    }
    return(scores);
}

function shuffleAnswers(answers) {
    var currentIndex = answers.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = answers[currentIndex];
      answers[currentIndex] = answers[randomIndex];
      answers[randomIndex] = temporaryValue;
    }
    return answers;
}

console.log('Environment variables ready:', process.env.OD_API_ID);

// Start the server
server.listen(3000, function(){
    console.log('server listening on *:3000')
});

// Read wordlist.txt and create a wordlist array
fs.stat(path, function(error, stats) {
    fs.open(path, "r", function(error, fd) {
     var buffer = new Buffer(stats.size);
      fs.read(fd, buffer, 0, buffer.length, null, function(error, bytesRead, buffer) {
        var data = buffer.toString("utf8");
        wordlist = data.split(',');
        console.log('Wordlist ready');
      });
    });
  });