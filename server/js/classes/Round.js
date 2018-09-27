class Round {
    constructor(question, hint, answers, correctAnswer){
        this._question = question;
        this._hint = hint;
        this._answers = answers;
        this._correctAnswer = correctAnswer;
    }

    get question(){ return this._question; }
    get hint(){ return this._hint; }
    get answers(){ return this._answers; }
    get correctAnswer(){ return this._correctAnswer }
};

// Need this for some reason
module.exports = Round;