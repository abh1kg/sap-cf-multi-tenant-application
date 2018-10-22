'use strict';

const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjB9';

class JwtToken {
    constructor() {
        this.accessToken = expiredToken;
        this.tokenType = 'bearer';
        this.parsedToken = this.parseToken(expiredToken);
    }

    get authHeader() {
        return `${this.tokenType} ${this.accessToken}`;
    }

    get accessTokenExpiresIn() {
        return this.expiresIn(this.accessToken);
    }

    get accessTokenExpiresSoon() {
        return this.expiresSoon(this.accessToken);
    }

    update(jwtToken) {
        this.accessToken = jwtToken.access_token;
        this.parsedToken = this.parseToken(jwtToken.access_token);
        return this;
    }

    algorithm() {
        return this.parsedToken[0].alg;
    }

    expiresIn() {
        return this.parsedToken[1].exp - Math.floor(Date.now() / 1000);
    }

    expiresSoon(token) {
        return this.expiresIn(token) < 15;
    }

    parseToken(token) {
        return token.split('.').slice(0, 2).map((part) => {
            return JSON.parse(Buffer.from(part, 'base64').toString('utf8'));
        });
    }
}

module.exports = JwtToken;