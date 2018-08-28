// var socket = io();
var socket = io({transports: ['websocket'], upgrade: false});
var $lobby = $('.lobby-screen');
var $rooms = $('#rooms li');
var $joinStatus = $('#join-status');
var $refresh = $('#refresh')
var $leave = $('#leave')

var $game = $('.game-screen');
var $players = $('#players');

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
                console.log('Cannot join room, capacity reached');
                $joinStatus.text('Unable to join');
            }
            else {
                currentRoom = selectedRoom.charAt(1);
                console.log('Sucessful join to ' + currentRoom);
                $lobby.hide();
                $game.show();
                // refreshRooms();
            }
        });
    }
})

socket.on('playersInRoom', function(playerCount){
    // console.log(playerCount);
    // console.log(playerCount[currentRoom]);

    $players.empty();

    for (let index = 0; index < playerCount[currentRoom]; index++) {
        console.log('Player ' + (index+1));
        $players.append('<li>Player ' + (index+1) + '</li>');
    }
    
});

$leave.on('click', function(){
    socket.emit('leaveRoom');
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
        console.log(callback);
        $rooms.each(function( index ) {
            $(this).children().text('Room ' + (index+1) +': ' + callback[index] + '/4');
        });
    });
}