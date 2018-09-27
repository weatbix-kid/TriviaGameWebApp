class Room {
    constructor(name){
        this._name = name;
        this._state = 'lobby';
        this._round = null;
        this._roundNumber = 0;
    }

    incrementRoundNum(){
        this._roundNumber++;
    }
    
    get name(){ return this._name; }
    get state(){ return this._state; }
    get round(){ return this._round; }
    get roundNumber(){ return this._roundNumber }

    set state(newState){ this._state = newState; }
    set round(newRound){ this._round = newRound; }
    set roundNumber(number){ this._roundNumber = number; }
};

module.exports = Room;