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
    clientSocket.on('requestRoom', function(selectedRoom){
        // If the room doesnt already exist
        if (!socket.sockets.adapter.rooms[selectedRoom]){
            // Create and join the room
            clientSocket.join(selectedRoom);
            console.log('A user created and joined room ' + selectedRoom)
        }
        else {
            console.log('A user requested to join room ' + selectedRoom)
            if (socket.sockets.adapter.rooms[selectedRoom].length <= 3 ){
                clientSocket.join(selectedRoom);
            }
            else {
                console.log('User tryed to join ' + selectedRoom + ' but its full')
            }
        }
    });
});

// Start the server
server.listen(3000, function(){
    console.log('server listening on *:3000')
});