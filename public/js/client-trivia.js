// var socket = io();
var socket = io({transports: ['websocket'], upgrade: false});
var $lobby = $('.lobby-screen');
var $rooms = $('#rooms li');
var $joinStatus = $('#join-status');
var $refresh = $('#refresh')
var $leave = $('#leave')

var $game = $('.game-screen');
var $players = $('#players');
var $playersUnready = $('#players-unready');
var $ready = $('#ready-status');

var currentRoom = null;

$(document).ready(function() {
    refreshRooms();
})

// On click request to join a room, join if there is space
$rooms.on('click', function(e){
    var selectedRoom = e.target.id;

    // Really dumb way to combat clicking list itself instead of the buttons in the list, may not need this in the future when I relayout the UI
    if (selectedRoom != ''){
        socket.emit('requestRoom', selectedRoom, function(status){
            if(!status) {
                $joinStatus.text('Unable to join');
            }
            else {
                currentRoom = selectedRoom.charAt(1);
                $lobby.hide();
                $game.show();
            }
        });
    }
})

socket.on('playersInRoom', function(playerCount){
    $players.empty();
    for (let index = 0; index < playerCount[currentRoom]; index++) {
        $players.append('<li>Player ' + (index+1) + '</li>');
    }
});

socket.on('totalPlayersReady', function(playerReadyCount){
    console.log(playerReadyCount);
    $playersUnready.text(playerReadyCount);
});

$ready.on('click', function(){
    // Send event to server to toggle ready status and check that all players are ready
    socket.emit('toggleReadyStatus');
    $(this).text(function(e, text){
        return text === "Ready" ? "Unready" : "Ready";
    })
})

$leave.on('click', function(){
    socket.emit('leaveRoom');
    $ready.text('Ready');
    refreshRooms();
    $game.hide();
    $lobby.show();         
})

$refresh.on('click', function(){
    refreshRooms();
})

// On click return player counts per room
function refreshRooms() {
    socket.emit('refreshRooms', function(callback){
        $rooms.each(function( index ) {
            $(this).children().text('Room ' + (index+1) +': ' + callback[index] + '/4');
        });
    });
}