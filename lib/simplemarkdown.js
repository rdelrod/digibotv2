/**
 * Simple Markdown Formatter.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 * @license MIT
 **/

'use strict';


const self = {
  /**
   * Underline text.
   *
   * @param {String} text - text to underline.
   * @returns {String} underlined text.
   **/
  underline: function(text) {
    return '__'+text+'__';
  },

  /**
   * Bold text.
   *
   * @param {String} text - text to bold.
   * @returns {String} underlined text.
   **/
  bold: function(text) {
    return '**'+text+'**';
  },

  /**
   * Code text
   *
   * @param {String} text - text to code format.
   * @returns {String} code formatted text.
   **/
  code: function(text) {
    return '```\n'+text+'```';
  },

  /**
   * Italicize text.
   *
   * @param {String} text - text to italicize.
   * @returns {String} underlined text.
   **/
  italic: function(text) {
    return '*'+text+'*';
  },

  /**
   * Default text format.
   *
   * @param {String} text - text to literally do nothing to.
   * @returns {String} underlined text.
   **/
  default: function(text) {
    return text;
  },

  /**
   * Parse a message for markdown.
   *
   * @param {String} text - text to parse.
   * @param {Object} opts - options to expand.
   *
   * @return {String} parsed plaintext.
   **/
  parse: (text, opts) => {
    let optAttributes = /\{([A-Z]+):?("?[\w\d\ !.]+"?)?\}/ig
    let isQuoted = /^["'].+["']$/gi

    let finaltext = text;

    if(opts) {
      for(let opt in opts) { // for each option in options supplied.
        if(opts.hasOwnProperty(opt)) { // unwanted props OUT.
          let match = text.match(optAttributes)

          if(match === null) {
            console.log('No matches on:', text);
            return text;
          }

          match.forEach((v) => {
            let replacedwith = '';
            let regcop = /([A-Z]+):?("?[\w\d\ !.]+"?)?/gi;
            let data   = regcop.exec(v);

            let style = data[1];
            let param = data[2];

            const weAreQuoted = isQuoted.test(param);

            // is given a style or is it dumped.
            if(param === undefined) {
              param = style;
              style = 'default';
            }

            // are we using a variable or raw data.
            if(weAreQuoted) {
              replacedwith = param.replace(/['"]+/g, '');
            } else {
              replacedwith = opts[param];
            }

            // if it isn't defined, thow an error.
            if(self[style] === undefined) {
              throw 'style:'+style+', doesn\'t exist';
            }

            // use this.stylFunction to modify replacedwith text
            const processedtext = self[style](replacedwith);

            console.log('replace: "'+v+'", with', processedtext, 'isData:', weAreQuoted)

            // modify the text.
            finaltext = finaltext.replace(v, processedtext);
          });
        }
      }
    }

    return finaltext;
  },

  safeparse: (text) => {
    let optAttributes = /{([A-Z]+):([\w\d!?.,\[\]"')(&*&^%$#@~\ ]+)}/ig

    let finaltext = text;
    console.log('[simplemarkdown] using safeparse. (no opts)');

    let match = text.match(optAttributes)

    if(match === null) {
      console.log('No matches on:', text);
      return text;
    }

    match.forEach((v) => {
      let replacedwith = '';
      let regcop = /([A-Z]+):([\w\d!?.,\[\]"')(&*&^%$#@~\ ]+)/gi;
      let data   = regcop.exec(v);

      let style = data[1];
      let param = data[2];

      replacedwith = param;

      // if it isn't defined, thow an error.
      if(self[style] === undefined) {
        throw 'style:'+style+', doesn\'t exist';
      }

      // use this.stylFunction to modify replacedwith text
      const processedtext = self[style](replacedwith);

      console.log('replace: "'+v+'", with', processedtext);

      // modify the text.
      finaltext = finaltext.replace(v, processedtext);
    });

    return finaltext;
  }
}

module.exports = self;
