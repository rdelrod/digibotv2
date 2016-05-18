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
     fs            = require('fs'),
     request       = require('request'),
     express       = require('express'),
     localMessageTable = [{
       id: 0,
       message: 'initial'
     }],
     config;

 let serverStatus = 'down';

 let confirmTable = {}
 let forwardName  = {}

 if(fs.existsSync('./config/forwardnames.json')) {
   forwardName = require('./config/forwardnames.json');
 }

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
   }, (err, res, body) => {
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
  * @param {String} parser  - parse input, or safe mode it. (defaut: non-safe)
  *
  * @returns {bool} success
  **/
 function sendMessage(bot, to, message, opts, parser) {
   if(to === undefined) { // using object params.
      to      = bot.to;
      message = bot.message;
      opts    = bot.opts;
      parser  = bot.parser;

      // shift bot.bot to bot.
      bot = bot.bot;
   }

   let finalmessage = '';
   if(parser !== 'safe') {
     console.log('Using strict parser')
     finalmessage =  markutils.parse(message, opts);
   } else {
     finalmessage = markutils.safeparse(message, opts);
   }

   return bot.sendMessage({
     to: to,
     message: finalmessage
   })
 }

 bot.on('disconnected', function() {
   console.log('bot', 'has been disconnected. Attempt reconnect.')
   bot.connect(); // attempt to reconnect.
 });

 bot.on('message', function(user, userID, channelID, message, rawEvent) {
   console.log(user, userID, message);
   let isMention    = new RegExp('^\<@'+bot.id+'\>');
   let isMentionOld = new RegExp('^@digibot');
   let isVstatus    = /(^|\s)verbose status/igm;
   let isForceShut  = /(^|\s)(force|kill) (kill|stop|shutdown|now)/ig;
   let isShutdown   = /(^|) (shutdown|stop)/ig;
   let isRestart    = /(^|\s)restart/ig;
   let isStart      = /(^|\s)start/ig;
   let isExecute    = /(^|\s)execute ([\s\S]+)$/ig
   let isStatus     = /(^|\s)status/ig;

   let isConfirm    = /(^|\s)confirm/ig;
   let isDeny       = /(^|\s)deny/ig;

   if(userID === bot.id) {
     console.log('drop', userID, '===', bot.id);
     return;
   }

   if(channelID !== config.channel && config.channel !== '*') {
     return; // ignore non channels in the filter
   }

   if(channelID === config.forward) { // if it's in forward channel, forward it.
     console.log('foward', 'is on forward channel.')
     return forwardToMc(user, userID, message);
   }

   // push into message cache.
   localMessageTable.push({
     uid: userID,
     mid: rawEvent.d.i,
     message: message
   });

   // check if it's a mention.
   if(!isMention.test(message) && !isMentionOld.test(message)) {
     console.log('drop', 'is not mention');
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

const forwardToMc = (username, userID, message) => {
  // translate ids to usernames
  const matches = message.match(/<@([\d]+)>/g);

  if(matches !== null) {
    let finaltext = message;
    matches.forEach(function(v) {
      finaltext = finaltext.replace(v, '@'+username);
    });

    message = finaltext;
  }

  if(forwardName[userID] !== undefined) {
    username = forwardName[userID].name
  }

  const cmd = 'say '+username+' said: '+message;
  return sendAuthenticatedRequest('get', 'server/sendCommand/'+encodeURIComponent(cmd), function(err) {
    if(err) {
      return sendMessage({
        bot: bot,
        to: config.forward,
        message: '<@{user}> Failed to relay the message: {err}',
        opts: {
          user: userID,
          err: err
        }
      });
    }
  });
}

let parseDeploy = data => {
  if(typeof data !== 'object') return;

  let event  = data.event;
  let repo   = data.repo;
  let edata  = data.data;

  console.log('deploy: got event', event);

  if(event !== 'success') return false;
  if(!edata.success) return false;

  // return a message.
  return sendMessage({
    bot: bot,
    to: config.dev,
    message: 'The service {bold:service} has been deployed from {bold:branch} 🎉',
    opts: {
      service: repo,
      branch: 'production'
    }
  });
}

let forwardMessage = (data) => {
  const message  = new Buffer(data.message, 'base64').toString('ascii');
  const username = data.from;

  return sendMessage({
    bot: bot,
    to: config.forward,
    message: '<{username}> {data}',
    opts: {
      username: username,
      data: message
    }
  })
}

/* Express "webhook" */
const app = express();

const bodyP  = require('body-parser');
const morgan = require('morgan');

app.use(bodyP.json());
app.use(morgan('dev'));

app.post('/event', (req, res) => {
  if(req.body.event === 'status') {
    if(config.production === false) { // if not production, ignore.
      return res.send({
        success: true
      });
    }

    // update our local cache of the status
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

  if(req.body.event === 'chatMessage') {
    forwardMessage(req.body.data);
  }

  if(req.body.event === 'deploy') {
    parseDeploy(req.body.data);
  }

  return res.send({
    success: true
  })
});

app.listen(config.port);
