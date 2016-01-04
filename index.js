/**
 * DiGit - Discord Github Bot.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 0.1.0
 * @license MIT
 **/

 var DiscordClient = require('discord.io'),
     github        = require('octonode'),
     githubhook    = require('githubhook'),
     moment        = require('moment'),
     client        = github.client(),
     localMessageTable = [{
       id: 0,
       message: 'initial'
     }],
     config;

 try {
   config = require('./config/config.json');
 } catch(err) {
   console.log('Failed to load the config file.');
   throw err;
 }

 var bot = new DiscordClient({
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
       message: "<@"+userID+"> All good 'capn!"
     });
   }

   var isInfo = /info (\w*)[ ]|(\w*\/\w*)/ig
   if(isInfo.test(message)) {
     var theirRepo = isInfo.exec(message)[0];

     if(theirRepo === null) {
       return; // probably not it, or something happened.
     }

     var repo = client.repo(theirRepo);

     repo.info(function(err, info) {
       if(err) {
         return;
       }

       var formattedMessage = "__**{{repo}}**__ - {{desc}}\n";
       formattedMessage    += "{{followers}} *followers*\n";
       formattedMessage    += "{{watchers}} *watchers*\n";

       // TODO: accept an object
       var responseTemplate = function(k, v) {
         formattedMessage = formattedMessage.replace('{{'+k+'}}', v);
       }

       // format the template.
       responseTemplate('repo', info.name);
       responseTemplate('followers', info.subscribers_count);
       responseTemplate('desc', info.description);
       responseTemplate('watchers', info.watchers_count);

       // TODO: allow detailed option

       return bot.sendMessage({
         to: channelID,
         message: formattedMessage
       });
     });
   }
 });

 var gh = githubhook({
   host: '0.0.0.0',
   port: 3420,
   path: '/digibot'
 });

 gh.listen();

 gh.on('push', function (repo, ref, data) {
   // TODO: Determine if you can "squash" together commits, by detecting if the messages are next to one another

   var formattedMessage = '';

   if(localMessageTable[localMessageTable.length-1].uid === bot.id) {
     console.log('notice: we were the last to send a message.')
     formattedMessage += '\n\n';

     var oMP = localMessageTable.length-1;
     var oldMessageT = localMessageTable[oMP].message.split('\n');

     var isCommitMessage = /just pushed a commit to ([a-Z])/g

     if(isCommitMessage.test(oldMessageT[0])) {

     } else {
       console.log(oldMessageT[0]);
     }

     // add room
     var editedoM = oldMessageT.splice(3);
     editedoM[2] = editedoM[2].replace(/\n/g, '')+'\n';
     editedoM = editedoM.join('\n');

     console.log(editedoM);
   } else {
     formattedMessage    += "**{{name}}** just pushed a commit to __**{{repo}}**__\n";
   }
   
   formattedMessage    += "*{{message}}*\n\n";
   formattedMessage    += "+ {{added}} files **|** - {{minus}} files **|** M: {{mod}} files"

   // TODO: accept an object
   var responseTemplate = function(k, v) {
     formattedMessage = formattedMessage.replace('{{'+k+'}}', v);
   }

   responseTemplate('name', data.head_commit.author.name);
   responseTemplate('repo', data.repository.name);
   responseTemplate('message', data.head_commit.message);
   responseTemplate('added', data.head_commit.added.length);
   responseTemplate('minus', data.head_commit.removed.length);
   responseTemplate('mod', data.head_commit.modified.length);

   return bot.sendMessage({
     to: config.channel,
     message: formattedMessage
   });
 });
