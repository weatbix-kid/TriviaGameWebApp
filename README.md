A simple multi user english triva game built on NodeJS utilizing socket.io and the oxford dictionary api

Known bugs:
1. One player can join a room ready up and immediatley leave the room tricking the room into thinking all players are ready and start a game with no players
2. If one player readys the countdown timer starts and doesnt account for when more people join only when they leave
3. The game doesnt commence if a player leaves using the button instead of disconnecting from the site even tho the other players are still ready
    - This is because if the player that was last to ready up leaves then there room becomes null and the server will emit 'start game' to nothing
4. Words that return only one definition breaks the game(?)
5. Words with absolutely no definition (e.g Inquire) cause the game to freeze until a new round is invoked

Potential fixs:
3. Use the current room instead of the clients current room

Additions:
- Consumes data from Oxford Dictionary API
- Randomized questions
- Added hints

