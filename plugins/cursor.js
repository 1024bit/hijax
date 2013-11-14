(function ($) {
    /**
    * 光标
    */
    $.cursor = {
        getCursorPosition: function (obj) { //获取光标在input或textarea中的位置
            var rng, result;
            result = 0;
            if (!$.browser.msie) { //IE以外 
                result = obj[0].selectionStart;
            } else { //IE  
                if (obj[0].tagName == "textarea") { //TEXTAREA 
                    rng = event.srcElement.createTextRange();
                    rng.moveToPoint(event.x, event.y);
                } else { //Text 
                    rng = document.selection.createRange();
                }
                rng.moveStart("character", -event.srcElement.value.length);
                result = rng.text.length;
            }
            return result;
        },
        insertText: function (obj, str) { //在光标位置的插入内容
            obj.focus();
            if (document.selection) {
                var sel = document.selection.createRange();
                sel.text = str;
            } else if (typeof obj.selectionStart == 'number' && typeof obj.selectionEnd == 'number') {
                var startPos = obj.selectionStart,
				endPos = obj.selectionEnd,
				cursorPos = startPos,
				tmpStr = obj.value;
                obj.value = tmpStr.substring(0, startPos) + str + tmpStr.substring(endPos, tmpStr.length);
                cursorPos += str.length;
                obj.selectionStart = obj.selectionEnd = cursorPos;
            } else {
                obj.value += str;
            }
        },
        moveEnd: function (obj) { //将光标移至文本框内容的末尾
            obj.focus();
            var len = obj.value.length;
            if (document.selection) {
                var sel = obj.createTextRange();
                sel.moveStart('character', len);
                sel.collapse();
                sel.select();
            } else if (typeof obj.selectionStart == 'number' && typeof obj.selectionEnd == 'number') {
                obj.selectionStart = obj.selectionEnd = len;
            }
        }
    };
})(jQuery);