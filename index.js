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

 bot.on('message', function(user, userID, channelID, message, rawEvent) {
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
   if(!isMention.test(message)) {
    return; // ignore non mentions for now
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
