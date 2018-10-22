'use strict';

const BaseError = require('../BaseError');

class ContinueWithNext extends BaseError {
    constructor() {
        super('Continue with next attempt');
        this.code = 'ECONTINUE';
    }
}
module.exports = ContinueWithNext;