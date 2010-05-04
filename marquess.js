(function($) {
  $.widget("ui.marquess", {
    options: {
      log: false,
      autoUpdate: 250,
      preview: true,
      toolbar: [
        [ 'bold', 'italic', '|', 'heading', 'bulleted_list', 'numbered_list', 'blockquote', '|', 'link', 'picture' ],
        [ 'undo', 'redo' ],
        [ 'preview', [ 'update', { title:true } ] ]
      ]
    },
    
    _init: function() {
      var self = this;
      
      if ($(this.element).hasClass('marquess')) { return this; }

      if (!$.os) {
        $.os = {
          name: (/(win|mac|linux|sunos|solaris|iphone)/.exec(navigator.platform.toLowerCase()) || ['unknown'])[0].replace('sunos', 'solaris')
        };
        $.os[$.os.name] = true;
      }

      this.editor = this.element[0];
      this.strategy = $.browser.webkit  ? $.ui.marquess.strategies.webkit  :
                      $.browser.opera   ? $.ui.marquess.strategies.opera   :
                      $.browser.msie    ? $.ui.marquess.strategies.msie    :
                      $.browser.mozilla ? $.ui.marquess.strategies.mozilla :
                      $.ui.marquess.strategies.common;
      
      this.buildUI();
      this.converter = new Showdown.converter();
      this.autoUpdate(this.options.autoUpdate);
      this.updatePreview();
      this.toolbar.sortable();
      this.undoStack = [];
      this.undoStack.pointer = -1;
      this.saveUndoState();
      $(this.editor).bind('input', function(e) {
        if (!self.startedTyping) {
          self.saveUndoState();
          self.startedTyping = true;
        }
        
        if (self.options.autoUpdate && !self.updater) {
          self.updater = window.setTimeout(function() { self.updatePreview() }, self.options.autoUpdate);
        }
      });
    },

    buildUI: function() {
      this.container = $('<div class="marquess-container"><div class="marquess-editor-pane"></div><div class="marquess-preview-pane"></div></div>');
      this.container.prepend(this.buildToolbar());
      $(this.element).addClass("marquess-editor").after(this.container).appendTo(this.container.find('.marquess-editor-pane'));
      this.preview_pane = this.container.find('.marquess-preview-pane')
                          .css({ height:this.container.find('.marquess-editor-pane').height() + 'px', overflow:'auto' })
                          .toggle(this.options.preview);
    },
    
    buildToolbar: function() {
      var self = this;
      var toolbar = this.toolbar = $('<div class="marquess-toolbar"></div>');
      this.buttons = {};
      $.map(this.options.toolbar, function(row, j) {
        var r = $('<ul class="marquess-toolbar-row"></ul>')
        $.map(row, function(button_name, i) {
          var opts = { title:false };
          if (button_name == '|') {
            $('<li class="separator"></li>').appendTo(r);
          } else {
            if (typeof(button_name) == 'object') {
              $.extend(opts, button_name[1]);
              button_name = button_name[0];
            }
            var command = $.ui.marquess.commands[button_name];
            if (command) {
              title = command.name;
              if (command.shortcut) {
                title += ' (' + command.shortcut.replace('Meta+', $.os.mac ? '&#x2318;' : 'Ctrl+') + ')';
              }
              var button = $('<li><a href="#" class="marquess-toolbar-button ' + button_name + '" title="' + title + '"><span>' + command.name + '</span></a></li>').appendTo(r).find('a');
              if (opts.title) { button.addClass('with-title'); }
              if (command.toggle) {
                button.toggleClass('active', self.options[command.toggle]);
                button.click(function() {
                  $(self.element).marquess(command.toggle, !self.options[command.toggle]);
                  button.toggleClass('active', self.options[command.toggle]);
                  return false;
                });
              } else {
                button.click(function() {
                  if (!$(this).hasClass('disabled')) {
                    self.executeCommand(button_name);
                  }
                  return false;
                });
              }
              if (command.shortcut) {
                $(self.editor).bind('keydown', command.shortcut, function() { button.click(); return false; });
              }
              self.buttons[button_name] = button;
            }
          }
        });
        toolbar.append(r);
      });
      return this.toolbar;
    },
    
    enableButton: function(button, toggle) {
      this.buttons[button].toggleClass('disabled', !toggle);
    },
    
    executeCommand: function(command) {
      command = $.ui.marquess.commands[command];
      if (command && command.fn) {
        command.fn(this);
      }
    },
    
    wrapOrInsert: function(before, after, defaultText) {
      if (this.startedTyping) { this.saveUndoState(); }
      this.undoStack[this.undoStack.pointer].bounds = this.strategy.selectionBounds(this.editor);
      this.strategy.wrapOrInsert(this.editor, before, after, defaultText);
      this.updatePreview(false);
      this.saveUndoState();
    },
    
    prefixLines: function(prefix, defaultText) {
      if (this.startedTyping) { this.saveUndoState(); }
      this.undoStack[this.undoStack.pointer].bounds = this.strategy.selectionBounds(this.editor);
      this.strategy.prefixLines(this.editor, prefix, defaultText);
      this.updatePreview(false);
      this.saveUndoState();
    },
    
    cycleHeading:function() {
      if (this.startedTyping) { this.saveUndoState(); }
      this.undoStack[this.undoStack.pointer].bounds = this.strategy.selectionBounds(this.editor);
      this.strategy.cycleHeading(this.editor);
      this.updatePreview(false);
      this.saveUndoState();
    },
    
    preview: function(value) {
      if (value == 'update') {
        this.updatePreview();
      } else {
        if (typeof(value) != 'undefined') {
          if (value != this.options.preview) {
            this.options.preview = value;
            this.buttons['preview'].toggleClass('active', value)
            this.preview_pane.slideToggle('fast');
          }
        }
        return this.options.preview;
      }
    },
    
    updatePreview: function(autoShow) {
      if (this.updater) {
        window.clearTimeout(this.updater);
        this.updater = null;
      }
      if (autoShow != false && !this.options.preview) { this.preview(true); }
      this.preview_pane.html(this.converter.makeHtml($(this.element).val()));
    },

    autoUpdate: function(value) {
      if (typeof(value) != 'undefined') {
        var self = this;
        if (this.updater) { clearInterval(this.updater); this.updater = null; }
        if (value) { this.updater = setInterval(function() { self.updatePreview(); }, value); }
        this.options.autoUpdate = value;
      }
      return this.options.autoUpdate;
    },
    
    saveUndoState:function() {
      this.undoStack = this.undoStack.slice(0, this.undoStack.pointer + 1);
      this.undoStack.push(this.strategy.state(this.editor));
      this.undoStack.pointer = this.undoStack.length - 1;
      this.startedTyping = false;
      this.enableButton('undo', this.undoStack.pointer > 0);
      this.enableButton('redo', false);
    },
    
    undo:function() {
      if (this.undoStack.pointer > 0) {
        if (this.startedTyping && this.undoStack.pointer == this.undoStack.length - 1) {
          this.undoStack.push(this.strategy.state(this.editor));
        } else {
          this.undoStack.pointer -= 1;
        }
        var state = this.undoStack[this.undoStack.pointer];
        this.strategy.restore(this.editor, state);
        this.updatePreview(false);
        this.startedTyping = false;
        this.enableButton('undo', this.undoStack.pointer > 0);
        this.enableButton('redo', this.undoStack.pointer < this.undoStack.length - 1);
      }
    },
    
    redo: function() {
      if (this.undoStack.pointer < this.undoStack.length - 1) {
        this.undoStack.pointer += 1;
        var state = this.undoStack[this.undoStack.pointer];
        this.strategy.restore(this.editor, state);
        this.updatePreview(false);
        this.startedTyping = false;
        this.enableButton('undo', this.undoStack.pointer > 0);
        this.enableButton('redo', this.undoStack.pointer < this.undoStack.length - 1);
      }
    },
    
    log: function(msg) {
      if(!this.options.log) return;
      if(window.console && console.log) {
        console.log(msg);
      }
    },

    destroy: function() {
      $.widget.prototype.apply(this, arguments);
    }
  });

  $.extend($.ui.marquess, {
    version: "0.1",
    getter: "html",
    commands: {
      bold: {
        name:'Bold',
        shortcut:'Meta+B',
        fn: function(editor) { editor.wrapOrInsert('**', '**', '**Bold text**'); }
      },
      italic: {
        name:'Italic',
        shortcut:'Meta+I',
        fn: function(editor) { editor.wrapOrInsert('*', '*', '*Italic text*'); }
      },
      heading: {
        name:'Cycle heading',
        shortcut:'Meta+H',
        fn: function(editor) { editor.cycleHeading(); }
      },
      bulleted_list: {
        name: 'Bulleted list',
        shortcut:'Meta+U',
        fn: function(editor) { editor.prefixLines('  - ', 'List item') }
      },
      numbered_list: {
        name: 'Numbered list',
        shortcut:'Meta+O',
        fn: function(editor) { editor.prefixLines('  1. ', 'List item') }
      },
      blockquote: {
        name: 'Blockquote',
        fn: function(editor) { editor.prefixLines('  > ', 'Blockquote') }
      },
      undo: {
        name: 'Undo',
        shortcut:'Meta+Z',
        fn: function(editor) { editor.undo(); }
      },
      redo: {
        name: 'Redo',
        shortcut:'Meta+Shift+Z',
        fn: function(editor) { editor.redo(); }
      },
      preview: {
        name: 'Preview',
        toggle: 'preview',
      },
      update: {
        name: 'Update',
        fn: function(editor) { editor.updatePreview(); }
      }
    },
    strategies: {
      common: {
        state: function(textarea) {
          return { text:$(textarea).val(), bounds:this.selectionBounds(textarea) };
        },
        
        restore: function(textarea, state) {
          $(textarea).val(state.text);
          this.setSelectionBounds(textarea, state.bounds.start, state.bounds.end);
          textarea.focus();
        },
        
        selectionBounds: function(textarea) {
          return { start:textarea.selectionStart, end:textarea.selectionEnd };
        },
        
        setSelectionBounds: function(textarea, start, end) {
          textarea.setSelectionRange(start, end);
        },
        
        wrapOrInsert: function(textarea, before, after, defaultText) {
          var bounds = this.selectionBounds(textarea);
          var start = bounds.start, end = bounds.end;
          var str = $(textarea).val();
          
          if (start == end && str.substring(end, end + after.length) == after) {
            bs = str.substring(0, start).replace(/([ \t]*)$/, after + '$1');
            $(textarea).val(bs + str.substring(end + after.length));
            this.setSelectionBounds(textarea, bs.length, bs.length);
          } else {
            var toInsert = (start == end ? defaultText : before + str.substring(start, end) + after);
            $(textarea).val(str.substring(0, start) + toInsert + str.substring(end));
            this.setSelectionBounds(textarea, start + before.length, start + toInsert.length - after.length);
          }
          textarea.focus();
        },
        
        prefixLines: function(textarea, prefix, defaultText) {
          var bounds = this.selectionBounds(textarea);
          var start = bounds.start, end = bounds.end;
          var str = $(textarea).val();
          
          var before = str.substring(0, bounds.start).replace(/[\r\n]+$/, ''), after = str.substring(bounds.end).replace(/^[\r\n]+/, '');
          var contents = ((bounds.start == bounds.end) ? defaultText : str.substring(bounds.start, bounds.end)).replace(/\s*$/, '');
          var previous_line_match = /\n([^\n]+)\s*$/.exec(before);
          if (previous_line_match && previous_line_match[1].substring(0, prefix.length) != prefix) {
            before += '\n';
            bounds.start += 1;
          }
          if (after.substring(0, prefix.length) != prefix) {
            after = '\n' + after;
          }
          
          if (contents.substring(0, prefix.length) == prefix) {
            var lines = contents.split(/\r?\n/), r = new RegExp('^' + prefix);
            for (i = 0; i < lines.length; i++) {
              lines[i] = lines[i].replace(r, '');
            }
            contents = lines.join('\n');
          } else {
            contents = prefix + contents.split(/\r?\n/).join('\n' + prefix);
          }
          
          $(textarea).val(before + contents + '\n' + after);
          this.setSelectionBounds(textarea, bounds.start, bounds.start + contents.length);
          textarea.focus();
        },
        
        cycleHeading: function(textarea) {
          var str = $(textarea).val(), bounds = this.selectionBounds(textarea);
          var before = str.substring(0, bounds.start), after = str.substring(bounds.end);
          var heading = (bounds.start == bounds.end) ? "Heading text" : str.substring(bounds.start, bounds.end);
          if (bounds.start > 0 && !(/\n$/.test(before))) { before += '\n'; bounds.start += 1; }
          if (!/^\r?\n/.test(after)) { after = '\n' + after; }
          if (match = /(\r?\n)$/.exec(heading)) {
            after = match[1] + after;
            heading = heading.substring(0, heading.length - match[1].length);
          }
          heading = heading.replace(/\n/g, ' ');
          var underline = '\n';
          if (match = /^(\r?\n)?z(\=+|\-+)(\r?\n)*/.exec(after)) {
            after = after.substring(match[0].length);
            if (match[2][0] == '-') {
              for (i = 0; i < heading.length; i++) { underline += '='; }
              underline += '\n';
            }
            underline += '\n';
          } else {
            for (i = 0; i < heading.length; i++) { underline += '-'; }
          }
          $(textarea).val(before + heading + underline + after);
          this.setSelectionBounds(textarea, bounds.start, bounds.start + heading.length);
          textarea.focus();
        },
      }
    }
  });
  
  $.extend($.ui.marquess.strategies, {
    webkit:  $.extend({}, $.ui.marquess.strategies.common, {
      
    }),
    opera:   $.extend({}, $.ui.marquess.strategies.common, {
      
    }),
    msie:    $.extend({}, $.ui.marquess.strategies.common, {
      
    }),
    mozilla: $.extend({}, $.ui.marquess.strategies.common, {
      
    })
  });
})(jQuery);

/*
 * jQuery Hotkeys Plugin
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Based upon the plugin by Tzury Bar Yochay:
 * http://github.com/tzuryby/hotkeys
 *
 * Original idea by:
 * Binny V A, http://www.openjs.com/scripts/events/keyboard_shortcuts/
*/
(function(jQuery){

	jQuery.hotkeys = {
		version: "0.8",

		specialKeys: {
			8: "backspace", 9: "tab", 13: "return", 16: "shift", 17: "ctrl", 18: "alt", 19: "pause",
			20: "capslock", 27: "esc", 32: "space", 33: "pageup", 34: "pagedown", 35: "end", 36: "home",
			37: "left", 38: "up", 39: "right", 40: "down", 45: "insert", 46: "del", 
			96: "0", 97: "1", 98: "2", 99: "3", 100: "4", 101: "5", 102: "6", 103: "7",
			104: "8", 105: "9", 106: "*", 107: "+", 109: "-", 110: ".", 111 : "/", 
			112: "f1", 113: "f2", 114: "f3", 115: "f4", 116: "f5", 117: "f6", 118: "f7", 119: "f8", 
			120: "f9", 121: "f10", 122: "f11", 123: "f12", 144: "numlock", 145: "scroll", 191: "/", 224: "meta"
		},

		shiftNums: {
			"`": "~", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", 
			"8": "*", "9": "(", "0": ")", "-": "_", "=": "+", ";": ": ", "'": "\"", ",": "<", 
			".": ">",  "/": "?",  "\\": "|"
		}
	};

	function keyHandler( handleObj ) {
		// Only care when a possible input has been specified
		if ( typeof handleObj.data !== "string" ) {
			return;
		}

		var origHandler = handleObj.handler,
			keys = handleObj.data.toLowerCase().split(" ");

		handleObj.handler = function( event ) {
			// Don't fire in text-accepting inputs that we didn't directly bind to
			if ( this !== event.target && (/textarea|select/i.test( event.target.nodeName ) ||
				 event.target.type === "text") ) {
				return;
			}

			// Keypress represents characters, not special keys
			var special = event.type !== "keypress" && jQuery.hotkeys.specialKeys[ event.which ],
				character = String.fromCharCode( event.which ).toLowerCase(),
				key, modif = "", possible = {};

			// check combinations (alt|ctrl|shift+anything)
			if ( event.altKey && special !== "alt" ) {
				modif += "alt+";
			}

			if ( event.ctrlKey && special !== "ctrl" ) {
				modif += "ctrl+";
			}

			// TODO: Need to make sure this works consistently across platforms
			if ( event.metaKey && !event.ctrlKey && special !== "meta" ) {
				modif += "meta+";
			}

			if ( event.shiftKey && special !== "shift" ) {
				modif += "shift+";
			}

			if ( special ) {
				possible[ modif + special ] = true;

			} else {
				possible[ modif + character ] = true;
				possible[ modif + jQuery.hotkeys.shiftNums[ character ] ] = true;

				// "$" can be triggered as "Shift+4" or "Shift+$" or just "$"
				if ( modif === "shift+" ) {
					possible[ jQuery.hotkeys.shiftNums[ character ] ] = true;
				}
			}
			
			for ( var i = 0, l = keys.length; i < l; i++ ) {
				if ( possible[ keys[i] ] ) {
					return origHandler.apply( this, arguments );
				}
			}
		};
	}

	jQuery.each([ "keydown", "keyup", "keypress" ], function() {
		jQuery.event.special[ this ] = { add: keyHandler };
	});
})(jQuery);

/*
   A A L        Source code at:
   T C A   <http://www.attacklab.net/>
   T K B
*/

var Showdown={};
Showdown.converter=function(){
var _1;
var _2;
var _3;
var _4=0;
this.makeHtml=function(_5){
_1=new Array();
_2=new Array();
_3=new Array();
_5=_5.replace(/~/g,"~T");
_5=_5.replace(/\$/g,"~D");
_5=_5.replace(/\r\n/g,"\n");
_5=_5.replace(/\r/g,"\n");
_5="\n\n"+_5+"\n\n";
_5=_6(_5);
_5=_5.replace(/^[ \t]+$/mg,"");
_5=_7(_5);
_5=_8(_5);
_5=_9(_5);
_5=_a(_5);
_5=_5.replace(/~D/g,"$$");
_5=_5.replace(/~T/g,"~");
return _5;
};
var _8=function(_b){
var _b=_b.replace(/^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|\Z)/gm,function(_c,m1,m2,m3,m4){
m1=m1.toLowerCase();
_1[m1]=_11(m2);
if(m3){
return m3+m4;
}else{
if(m4){
_2[m1]=m4.replace(/"/g,"&quot;");
}
}
return "";
});
return _b;
};
var _7=function(_12){
_12=_12.replace(/\n/g,"\n\n");
var _13="p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del";
var _14="p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math";
_12=_12.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm,_15);
_12=_12.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math)\b[^\r]*?.*<\/\2>[ \t]*(?=\n+)\n)/gm,_15);
_12=_12.replace(/(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,_15);
_12=_12.replace(/(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g,_15);
_12=_12.replace(/(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g,_15);
_12=_12.replace(/\n\n/g,"\n");
return _12;
};
var _15=function(_16,m1){
var _18=m1;
_18=_18.replace(/\n\n/g,"\n");
_18=_18.replace(/^\n/,"");
_18=_18.replace(/\n+$/g,"");
_18="\n\n~K"+(_3.push(_18)-1)+"K\n\n";
return _18;
};
var _9=function(_19){
_19=_1a(_19);
var key=_1c("<hr />");
_19=_19.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm,key);
_19=_19.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm,key);
_19=_19.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm,key);
_19=_1d(_19);
_19=_1e(_19);
_19=_1f(_19);
_19=_7(_19);
_19=_20(_19);
return _19;
};
var _21=function(_22){
_22=_23(_22);
_22=_24(_22);
_22=_25(_22);
_22=_26(_22);
_22=_27(_22);
_22=_28(_22);
_22=_11(_22);
_22=_29(_22);
_22=_22.replace(/  +\n/g," <br />\n");
return _22;
};
var _24=function(_2a){
var _2b=/(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;
_2a=_2a.replace(_2b,function(_2c){
var tag=_2c.replace(/(.)<\/?code>(?=.)/g,"$1`");
tag=_2e(tag,"\\`*_");
return tag;
});
return _2a;
};
var _27=function(_2f){
_2f=_2f.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,_30);
_2f=_2f.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,_30);
_2f=_2f.replace(/(\[([^\[\]]+)\])()()()()()/g,_30);
return _2f;
};
var _30=function(_31,m1,m2,m3,m4,m5,m6,m7){
if(m7==undefined){
m7="";
}
var _39=m1;
var _3a=m2;
var _3b=m3.toLowerCase();
var url=m4;
var _3d=m7;
if(url==""){
if(_3b==""){
_3b=_3a.toLowerCase().replace(/ ?\n/g," ");
}
url="#"+_3b;
if(_1[_3b]!=undefined){
url=_1[_3b];
if(_2[_3b]!=undefined){
_3d=_2[_3b];
}
}else{
if(_39.search(/\(\s*\)$/m)>-1){
url="";
}else{
return _39;
}
}
}
url=_2e(url,"*_");
var _3e="<a href=\""+url+"\"";
if(_3d!=""){
_3d=_3d.replace(/"/g,"&quot;");
_3d=_2e(_3d,"*_");
_3e+=" title=\""+_3d+"\"";
}
_3e+=">"+_3a+"</a>";
return _3e;
};
var _26=function(_3f){
_3f=_3f.replace(/(!\[(.*?)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,_40);
_3f=_3f.replace(/(!\[(.*?)\]\s?\([ \t]*()<?(\S+?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,_40);
return _3f;
};
var _40=function(_41,m1,m2,m3,m4,m5,m6,m7){
var _49=m1;
var _4a=m2;
var _4b=m3.toLowerCase();
var url=m4;
var _4d=m7;
if(!_4d){
_4d="";
}
if(url==""){
if(_4b==""){
_4b=_4a.toLowerCase().replace(/ ?\n/g," ");
}
url="#"+_4b;
if(_1[_4b]!=undefined){
url=_1[_4b];
if(_2[_4b]!=undefined){
_4d=_2[_4b];
}
}else{
return _49;
}
}
_4a=_4a.replace(/"/g,"&quot;");
url=_2e(url,"*_");
var _4e="<img src=\""+url+"\" alt=\""+_4a+"\"";
_4d=_4d.replace(/"/g,"&quot;");
_4d=_2e(_4d,"*_");
_4e+=" title=\""+_4d+"\"";
_4e+=" />";
return _4e;
};
var _1a=function(_4f){
_4f=_4f.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm,function(_50,m1){
return _1c("<h1>"+_21(m1)+"</h1>");
});
_4f=_4f.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm,function(_52,m1){
return _1c("<h2>"+_21(m1)+"</h2>");
});
_4f=_4f.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm,function(_54,m1,m2){
var _57=m1.length;
return _1c("<h"+_57+">"+_21(m2)+"</h"+_57+">");
});
return _4f;
};
var _58;
var _1d=function(_59){
_59+="~0";
var _5a=/^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm;
if(_4){
_59=_59.replace(_5a,function(_5b,m1,m2){
var _5e=m1;
var _5f=(m2.search(/[*+-]/g)>-1)?"ul":"ol";
_5e=_5e.replace(/\n{2,}/g,"\n\n\n");
var _60=_58(_5e);
_60=_60.replace(/\s+$/,"");
_60="<"+_5f+">"+_60+"</"+_5f+">\n";
return _60;
});
}else{
_5a=/(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g;
_59=_59.replace(_5a,function(_61,m1,m2,m3){
var _65=m1;
var _66=m2;
var _67=(m3.search(/[*+-]/g)>-1)?"ul":"ol";
var _66=_66.replace(/\n{2,}/g,"\n\n\n");
var _68=_58(_66);
_68=_65+"<"+_67+">\n"+_68+"</"+_67+">\n";
return _68;
});
}
_59=_59.replace(/~0/,"");
return _59;
};
_58=function(_69){
_4++;
_69=_69.replace(/\n{2,}$/,"\n");
_69+="~0";
_69=_69.replace(/(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm,function(_6a,m1,m2,m3,m4){
var _6f=m4;
var _70=m1;
var _71=m2;
if(_70||(_6f.search(/\n{2,}/)>-1)){
_6f=_9(_72(_6f));
}else{
_6f=_1d(_72(_6f));
_6f=_6f.replace(/\n$/,"");
_6f=_21(_6f);
}
return "<li>"+_6f+"</li>\n";
});
_69=_69.replace(/~0/g,"");
_4--;
return _69;
};
var _1e=function(_73){
_73+="~0";
_73=_73.replace(/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g,function(_74,m1,m2){
var _77=m1;
var _78=m2;
_77=_79(_72(_77));
_77=_6(_77);
_77=_77.replace(/^\n+/g,"");
_77=_77.replace(/\n+$/g,"");
_77="<pre><code>"+_77+"\n</code></pre>";
return _1c(_77)+_78;
});
_73=_73.replace(/~0/,"");
return _73;
};
var _1c=function(_7a){
_7a=_7a.replace(/(^\n+|\n+$)/g,"");
return "\n\n~K"+(_3.push(_7a)-1)+"K\n\n";
};
var _23=function(_7b){
_7b=_7b.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,function(_7c,m1,m2,m3,m4){
var c=m3;
c=c.replace(/^([ \t]*)/g,"");
c=c.replace(/[ \t]*$/g,"");
c=_79(c);
return m1+"<code>"+c+"</code>";
});
return _7b;
};
var _79=function(_82){
_82=_82.replace(/&/g,"&amp;");
_82=_82.replace(/</g,"&lt;");
_82=_82.replace(/>/g,"&gt;");
_82=_2e(_82,"*_{}[]\\",false);
return _82;
};
var _29=function(_83){
_83=_83.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g,"<strong>$2</strong>");
_83=_83.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,"<em>$2</em>");
return _83;
};
var _1f=function(_84){
_84=_84.replace(/((^[ \t]*>[ \t]?.+\n(.+\n)*\n*)+)/gm,function(_85,m1){
var bq=m1;
bq=bq.replace(/^[ \t]*>[ \t]?/gm,"~0");
bq=bq.replace(/~0/g,"");
bq=bq.replace(/^[ \t]+$/gm,"");
bq=_9(bq);
bq=bq.replace(/(^|\n)/g,"$1  ");
bq=bq.replace(/(\s*<pre>[^\r]+?<\/pre>)/gm,function(_88,m1){
var pre=m1;
pre=pre.replace(/^  /mg,"~0");
pre=pre.replace(/~0/g,"");
return pre;
});
return _1c("<blockquote>\n"+bq+"\n</blockquote>");
});
return _84;
};
var _20=function(_8b){
_8b=_8b.replace(/^\n+/g,"");
_8b=_8b.replace(/\n+$/g,"");
var _8c=_8b.split(/\n{2,}/g);
var _8d=new Array();
var end=_8c.length;
for(var i=0;i<end;i++){
var str=_8c[i];
if(str.search(/~K(\d+)K/g)>=0){
_8d.push(str);
}else{
if(str.search(/\S/)>=0){
str=_21(str);
str=str.replace(/^([ \t]*)/g,"<p>");
str+="</p>";
_8d.push(str);
}
}
}
end=_8d.length;
for(var i=0;i<end;i++){
while(_8d[i].search(/~K(\d+)K/)>=0){
var _91=_3[RegExp.$1];
_91=_91.replace(/\$/g,"$$$$");
_8d[i]=_8d[i].replace(/~K\d+K/,_91);
}
}
return _8d.join("\n\n");
};
var _11=function(_92){
_92=_92.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g,"&amp;");
_92=_92.replace(/<(?![a-z\/?\$!])/gi,"&lt;");
return _92;
};
var _25=function(_93){
_93=_93.replace(/\\(\\)/g,_94);
_93=_93.replace(/\\([`*_{}\[\]()>#+-.!])/g,_94);
return _93;
};
var _28=function(_95){
_95=_95.replace(/<((https?|ftp|dict):[^'">\s]+)>/gi,"<a href=\"$1\">$1</a>");
_95=_95.replace(/<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,function(_96,m1){
return _98(_a(m1));
});
return _95;
};
var _98=function(_99){
function char2hex(ch){
var _9b="0123456789ABCDEF";
var dec=ch.charCodeAt(0);
return (_9b.charAt(dec>>4)+_9b.charAt(dec&15));
}
var _9d=[function(ch){
return "&#"+ch.charCodeAt(0)+";";
},function(ch){
return "&#x"+char2hex(ch)+";";
},function(ch){
return ch;
}];
_99="mailto:"+_99;
_99=_99.replace(/./g,function(ch){
if(ch=="@"){
ch=_9d[Math.floor(Math.random()*2)](ch);
}else{
if(ch!=":"){
var r=Math.random();
ch=(r>0.9?_9d[2](ch):r>0.45?_9d[1](ch):_9d[0](ch));
}
}
return ch;
});
_99="<a href=\""+_99+"\">"+_99+"</a>";
_99=_99.replace(/">.+:/g,"\">");
return _99;
};
var _a=function(_a3){
_a3=_a3.replace(/~E(\d+)E/g,function(_a4,m1){
var _a6=parseInt(m1);
return String.fromCharCode(_a6);
});
return _a3;
};
var _72=function(_a7){
_a7=_a7.replace(/^(\t|[ ]{1,4})/gm,"~0");
_a7=_a7.replace(/~0/g,"");
return _a7;
};
var _6=function(_a8){
_a8=_a8.replace(/\t(?=\t)/g,"    ");
_a8=_a8.replace(/\t/g,"~A~B");
_a8=_a8.replace(/~B(.+?)~A/g,function(_a9,m1,m2){
var _ac=m1;
var _ad=4-_ac.length%4;
for(var i=0;i<_ad;i++){
_ac+=" ";
}
return _ac;
});
_a8=_a8.replace(/~A/g,"    ");
_a8=_a8.replace(/~B/g,"");
return _a8;
};
var _2e=function(_af,_b0,_b1){
var _b2="(["+_b0.replace(/([\[\]\\])/g,"\\$1")+"])";
if(_b1){
_b2="\\\\"+_b2;
}
var _b3=new RegExp(_b2,"g");
_af=_af.replace(_b3,_94);
return _af;
};
var _94=function(_b4,m1){
var _b6=m1.charCodeAt(0);
return "~E"+_b6+"E";
};
};

