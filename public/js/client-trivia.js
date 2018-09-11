// var socket = io();
var socket = io({transports: ['websocket'], upgrade: false});
var $lobby = $('.lobby-screen');
var $rooms = $('#rooms li');
var $joinStatus = $('#join-status');
var $refresh = $('#refresh')
var $leave = $('#leave')

var $game = $('.game-screen');
var $waitingRoom = $('.waiting-room');
var $newRound = $('.new-round');
var $players = $('#players');
var $playersUnready = $('#players-unready');
var $ready = $('#ready-status');
var $gameStartNotice = $('#gamestart-notice');

var $roundForm = $('#round-form');
var $question = $('#q');
var $answers = $('#ans');

var $wait = $('.wait-screen');
var $results = $('.results-screen');

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
    $playersUnready.text(playerReadyCount[0] + '/' + playerReadyCount[1] + ' players are ready');
});

socket.on('notifyGameState', function(msg){
    if(!msg)
        $gameStartNotice.text('');
    else
        $gameStartNotice.text(msg)
})

socket.on('startGame', function(newRoundData){
    $waitingRoom.hide();
    $newRound.show();
    console.log(newRoundData);
    populateRoundForm(newRoundData)
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

$answers.on('click', function(e){
    e.preventDefault();
    var selectedAnswer = e.target.getAttribute('value');
    if(selectedAnswer != null){
        console.log(selectedAnswer);
        socket.emit('roundResponse', selectedAnswer, function(callback){
            if(callback == true){
                console.log('Answer recieved from server, wait for new round')
                $newRound.hide();
                $wait.show();
            }
        })
    }
})

function populateRoundForm(roundData){
    $question.text(roundData._question);
    $answers.children().each(function(index){
        $(this).children().text(roundData._answers[index]);
    });
}

// On click return player counts per room
function refreshRooms() {
    socket.emit('refreshRooms', function(count, gameState){
        $rooms.each(function(index) {
            if (count[index] != 4 && gameState[index] != true){
                $(this).children().text('Room ' + (index+1) +': ' + count[index] + '/4');
                $(this).children().prop('disabled',false);
            }
            else {
                $(this).children().text('Room ' + (index+1) +': ' + count[index] + '/4');
                $(this).children().prop('disabled',true);
                if(gameState[index] == true)
                    $(this).children().text('Room ' + (index+1) +': ' + count[index] + '/4 In-Game');
            }
        });
    });
}