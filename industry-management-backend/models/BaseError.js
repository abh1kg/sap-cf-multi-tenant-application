'use strict';

function createSymbol(name) {
    /* jshint newcap:false */
    return Symbol(name);
}

const descriptionSymbol = createSymbol('description');

class BaseError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }

    get description() {
        return this[descriptionSymbol] || this.message;
    }

    set description(description) {
        this[descriptionSymbol] = description;
    }
}

module.exports = BaseError;