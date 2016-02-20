/**
 * DiGitv2 Bot
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

 'use strict';

 let DiscordClient = require('discord.io'),
     moment        = require('moment'),
     request       = require('request'),
     express       = require('express'),
     localMessageTable = [{
       id: 0,
       message: 'initial'
     }],
     config;

 let serverStatus = 'down';

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
     console.log(bot.username + " - (" + bot.id + ")");
 });


 /**
  * Send an authenticated request to the API.
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

     return next(null, body);
   });
 }

 bot.on('message', function(user, userID, channelID, message, rawEvent) {
   // DEBUG: console.log(user, userID, message);

   if(channelID !== config.channel && config.channel !== '*') {
     return; // ignore non channels in the filter
   }

   localMessageTable.push({
     uid: userID,
     mid: rawEvent.d.id,
     message: message
   });

   // check if it's a mention.
   var isMention = new RegExp('^\<@'+bot.id+'\>');
   var isMentionOld = new RegExp('^@digibot');
   if(!isMention.test(message) && !isMentionOld.test(message)) {
    return; // ignore non mentions for now
   }

   if(config.admins.indexOf(userID) !== -1) {
     var isRestart = /(^|\s)restart/ig;
     if(isRestart.test(message)) {
       return bot.sendMessage({
         to: channelID,
         message: "<@"+userID+"> restarting isn't currently supported. Try stop, then start"
       });
     }

     var isShutdown = /(^|\s)shutdown/ig;
     if(isShutdown.test(message)) {
       return sendAuthenticatedRequest('get', 'server/stop', function(err, res) {
         if(err) {
           console.log('[digibot] authReq reported error:', err)
           return false;
         }

         try {
           res = JSON.parse(res);
         } catch(err) {
           return false;
         }

         if(!res.success) {
           return bot.sendMessage({
             to: channelID,
             message: "<@"+userID+"> Failed to shutdown the server."
           });
         }

         return bot.sendMessage({
           to: channelID,
           message: "<@"+userID+"> Sent stop request!"
         });
       })
     }

     var isVstatus = /(^| )verbose status/igm;
     if(isVstatus.test(message)) {
       return sendAuthenticatedRequest('get', 'server/status', function(err, res) {
         if(err) {
           console.log('[digibot] authReq reported error:', err)
           return false;
         }

         try {
           res = JSON.parse(res);
         } catch(err) {
           return false;
         }

         return bot.sendMessage({
           to: channelID,
           message: "<@"+userID+"> API reports **"+res.status+"** with **"+res.latency+"**ms mcfd latency"
         });
       })
     }

     var isStart = /(^|\s)start/ig;
     if(isStart.test(message)) {
       return sendAuthenticatedRequest('get', 'server/start', function(err, res) {
         if(err) {
           console.log('[digibot] authReq reported error:', err)
           return false;
         }

         try {
           res = JSON.parse(res);
         } catch(err) {
           return false;
         }

         if(!res.success) {
           return bot.sendMessage({
             to: channelID,
             message: "<@"+userID+"> Failed to start the server"
           });
         }

         return bot.sendMessage({
           to: channelID,
           message: "<@"+userID+"> Started."
         });
       })
     }
   }

   var isStatus = /(^|\s)status/ig;
   if(isStatus.test(message)) {
     return bot.sendMessage({
       to: channelID,
       message: "<@"+userID+"> server is: **"+serverStatus+"**"
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

    bot.sendMessage({
      to: config.broadcast,
      message: "server is now **"+req.body.data+"**"
    })
  }

  res.send({
    success: true
  })
});

app.listen(8083)
