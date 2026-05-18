'use strict';

// Vercel serverless entry — exports the Express app as the request handler.
// All /api/* requests are routed here via vercel.json rewrites.
const app = require('../server/app');

module.exports = app;
