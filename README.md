A simple multi user english triva game built on NodeJS utilizing socket.io and the oxford dictionary api


Known bugs:
1. One player can join a room ready up and immediatley leave the room tricking the room into thinking all players are ready and start a game with no players
2. If one player readys the countdown timer starts and doesnt account for when more people join only when they leave
3. The game doesnt commence if a player leaves using the button instead of disconnecting from the site even tho the other players are still ready
    - This is because if the player that was last to ready up leaves then there room becomes null and the server will emit 'start game' to nothing

Potential fixs:
3. Use the current room instead of the clients current room

Fixed:
- Rooms that are have reached capacity or are in 'In-Game' arnt joinable
- Players can see why a game isnt joinable

Additions:
- Made a room properties object every time a room is created that has basic properties such as, room name, currently connected sockets, current game state and current round number, which will be useful for later on
