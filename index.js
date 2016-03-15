/**
 * DiGitv2 Bot
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

 'use strict';

 const markutils   = require('./lib/simplemarkdown.js');

 let DiscordClient = require('discord.io'),
     request       = require('request'),
     express       = require('express'),
     localMessageTable = [{
       id: 0,
       message: 'initial'
     }],
     config;

 let serverStatus = 'down';

 // load the config
 try {
   config = require('./config/config.json');
 } catch(err) {
   console.log('Failed to load the config file.');
   throw err;
 }

 const bot = new DiscordClient({
     autorun: true,
     email: config.email,
     password: config.password,
     token: config.token
 });

 bot.on('ready', function() {
     console.log(bot.username + ' - (' + bot.id + ')');
 });


 /**
  * Send an authenticated request to the API.
  *
  * @param {string} method   - method type (GET/POST)
  * @param {string} endpoint - REST /endpoint
  * @param {Function} next   - callback
  * @callback next
  *
  * @returns {undefined}
  **/
 function sendAuthenticatedRequest(method, endpoint, next) {
   let serverURI = config.uri.replace(/\/$/, '')+'/';
   let fullURI = serverURI+endpoint;

   // make the request
   request[method](fullURI, {
     headers: {
       'Authentication': 'Basic '+config.authentication.accessToken+':'+config.authentication.accessTokenSecret
     }
   }, function(err, http, body) {
     if(err) {
       return next(err);
     }

     try {
       body = JSON.parse(body);
     } catch(e) {
       return next(e);
     }

     if(!body.success) { // on error
       return next(body.reason);
     }

     return next(null, body);
   });
 }

 /**
  * Simple markutils wrapper for bot messages.
  *
  * @param {Object} bot     - bot object from discord.
  * @param {String/Int} to  - channel id to send to.
  * @param {String} message - plaintext object.
  * @param {Object} opts    - handlebars like parse object.
  *
  * @returns {bool} success
  **/
 function sendMessage(bot, to, message, opts) {
   if(to === undefined) { // using object params.
      to = bot.to;
      message = bot.message;
      opts = bot.opts;

      // shift bot.bot to bot.
      bot = bot.bot;
   }

   return bot.sendMessage({
     to: to,
     message: markutils.parse(message, opts)
   })
 }

 bot.on('message', function(user, userID, channelID, message, rawEvent) {
   // DEBUG: console.log(user, userID, message);
   let isMention    = new RegExp('^\<@'+bot.id+'\>');
   let isMentionOld = new RegExp('^@digibot');
   let isVstatus    = /(^|\s)verbose status/igm;
   let isForceShut  = /(^|\s)(force|kill) (kill|stop|shutdown|now)/ig;
   let isShutdown   = /(^|) (shutdown|stop)/ig;
   let isRestart    = /(^|\s)restart/ig;
   let isStart      = /(^|\s)start/ig;
   let isExecute    = /(^|\s)execute ([\s\S]+)$/ig
   let isStatus     = /(^|\s)status/ig;

   if(channelID !== config.channel && config.channel !== '*') {
     return; // ignore non channels in the filter
   }

   // push into message cache.
   localMessageTable.push({
     uid: userID,
     mid: rawEvent.d.i,
     message: message
   });

   // check if it's a mention.
   if(!isMention.test(message) && !isMentionOld.test(message)) {
    return; // ignore non mentions for now
   }

   // priveleged functions.
   if(config.admins.indexOf(userID) !== -1) {
     if(isRestart.test(message)) {
       return sendMessage({
         bot: bot,
         to: channelID,
         message: '<@{user}> restarting isn\'t currently supported. Try stop, then start',
         opts: {
           user: userID
         }
       });
     }

     if(isExecute.test(message)) {
       console.log('execute commmand');
       let data = message.match(isExecute)[0].replace(' execute ', '');
       return sendAuthenticatedRequest('get', 'server/sendCommand/'+encodeURIComponent(data), function(err) {
         if(err) {
           return sendMessage({
             bot: bot,
             to: channelID,
             message: '<@{user}> Failed to execute the command: {err}',
             opts: {
               user: userID,
               err: err
             }
           });
         }

         // send the response.
         return sendMessage({
           bot: bot,
           to: channelID,
           message: '<@{user}> Command Executed.',
           opts: {
             user: userID
           }
         });
       });
     }

     if(isForceShut.test(message)) {
       console.log('[mc-api] WARNING: Told to FORCE KILL the server.')
       return sendAuthenticatedRequest('get', 'server/forceStop', function(err) {
         if(err) {
           return sendMessage({
             bot: bot,
             to: channelID,
             message: '<@{user}> failed to forcekill the server...?',
             opts: {
               user: userID,
               reason: err
             }
           });
         }

         serverStatus = 'down';

         return sendMessage({
           bot: bot,
           to: channelID,
           message: '<@{user}> Server should be dead {bold:"NOW"}.',
           opts: {
             user: userID
           }
         });
       });
     }

     if(isShutdown.test(message)) {
       return sendAuthenticatedRequest('get', 'server/stop', function(err) {
         if(err) {
           return sendMessage({
             bot: bot,
             to: channelID,
             message: '<@{user}> Failed to shutdown the server. Reason: {reason}',
             opts: {
               user: userID,
               reason: err
             }
           });
         }

         return sendMessage({
           bot: bot,
           to: channelID,
           message: '<@{user}> Sent stop request!',
           opts: {
             user: userID
           }
         });
       });
     }

     if(isVstatus.test(message)) {
       return sendAuthenticatedRequest('get', 'server/status', function(err, res) {
         if(err) {
           console.log('[digibot] authReq reported error:', err)
           return false;
         }

         // send the response.
         return sendMessage({
           bot: bot,
           to: channelID,
           message: '<@{user}> API reports {italic:status} with {bold:latency}ms mcfd latency',
           opts: {
             user: userID,
             status: serverStatus,
             latency: res.latency
           }
         });
       });
     }

     if(isStart.test(message)) {
       return sendAuthenticatedRequest('get', 'server/start', function(err, res) {
         if(err) {
           console.log('[digibot] authReq reported error:', err)
           return false;
         }

         if(!res.success) {
           return sendMessage({
             bot: bot,
             to: channelID,
             message: '<@{user}> Failed to start the server',
             opts: {
               user: userID
             }
           });
         }

         return sendMessage({
           bot: bot,
           to: channelID,
           message: '<@{user}> Started.',
           opts: {
             user: userID
           }
         });
       })
     }
   }

   if(isStatus.test(message)) {
     return sendMessage({
       bot: bot,
       to: channelID,
       message: '<@{user}> server is: {bold:serverstatus}',
       opts: {
         user: userID,
         serverstatus: serverStatus
       }
     });
   }
 });


/* Express "webhook" */
const app = express();

const bodyP  = require('body-parser');
const morgan = require('morgan');

app.use(bodyP.json());
app.use(morgan('dev'));

app.post('/event', function(req, res) {
  console.log(req.body);

  if(req.body.event === 'status') {
    serverStatus = req.body.data;

    sendMessage({
      bot: bot,
      to: config.broadcast,
      message: 'server is now {bold:status}',
      opts: {
        status: serverStatus
      }
    });
  }

  res.send({
    success: true
  })
});

app.listen(config.port);
