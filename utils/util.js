(function ($) {
    $.util = $.extend({}, {
        // 
        unparam: function (url) {
			if ($.type(url) === 'object') return url;
            if (url === '') {
                return {};
            }
            var vars = {}, hash, i,
                urlParams = url.indexOf('?') > -1 ? url.split('?')[1] : url
            ;
            var hashes = urlParams.split('&');
            for (i = 0; i < hashes.length; i++) {
                hash = hashes[i].split('=');
                vars[hash[0]] = decodeURIComponent(hash[1]).replace(/\+/g, ' ');
            }
            return vars;
        },
        // 应用范围内生成一个递增的数
        autoId: function () {
            return ++$.uuid;
        },
        // 生成伪GUID
        guid: function () {
            // 生成4位16进制数
            function S4() {
                return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
            }
            return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
        },
        // 定义$.hijax对象属性
        def: function (prop) {
            var props = {};
            if (!$.isPlainObject(prop)) {
                props[$.util.camelize(prop, '_')] = arguments[1];
            } else {
                $.each(prop, function (key, val) {
                    props[$.util.camelize(key, '_')] = val;
                });
            }
            $.hijax = $.extend($.hijax || {}, props);
        }, 

        /**
        * 字符类
        */
        // 小峰驼风格
        camelize: function (str, separator) {
            var re = separator + '([a-z])';
            return str.toLowerCase().replace(new RegExp(re, 'g'), function (m, m1) { return m1.toUpperCase(); });
        },
        //获取字符串的字节数
        getBytes: function (str) {
            var c, b, l;
            b = 0;
            l = str.length;
            while (l) {
                c = str.charCodeAt(--l);
                b += (c < 128) ? 1 : ((c < 2048) ? 2 : ((c < 65536) ? 2 : 4));
            }
            return b;
        },
        // 将字符串的首字母转换为大写
        ucfirst: function (str) {
            return str.replace(/^([a-z])/i, function (m) {
                return m.toUpperCase();
            });
        },
        // 生成html字符片段对应的dom对象
        domlize: function (html) {
            var $div = $('<div/>');
            $div[0].innerHTML = html;
            return $div.children().get(0);
        },

        // 截取字符串
        truncate: function (str, truncate) {
            if (str.length > truncate) str = str.slice(0, truncate) + '...';
            return str;
        },

        // 字符统计
        count: function (str) {
            var chinese = str.match(/[^\x00-\x7F]/g),
                l = (chinese && chinese.length) || 0;
            return str.length - l + l * 2;
        },
        // 防止XSS攻击
        encodeHTMLSource: function() {
            var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': '&#34;', "'": '&#39;', "/": '&#47;' },
                matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
            return function(code) {
                return code ? code.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : code;
            };
        }, 
        /**
        * 数组类
        */
        // [1, [2, 3]] -> [1, 2, 3]
        flatten: function (array) {
            return array.length > 0 ? [].concat.apply([], array) : array;
        },
        // $.util.offset.call([1, 2, 3, 4, 5, 6], 1, 3, 4) -> [1, 5, 2, 3, 4, 6]
        // 将从idx1开始的len个元素平移到idx2后
        offset: function (idx1, len, idx2) {
            var frag = this.splice(idx1, len), 
                start = idx2 - len;
                
            start = (start > 0) ? (start + 1) : (idx2 + 1);
            this.splice.apply(this, [start, 0].concat(frag));
            return this;
        },

        /**
        * 对象类
        */
        compact: function (obj) {
            var result = [];
            if ($.type(obj) !== 'array') {
                result = {};
                obj = $.extend(true, {}, obj);
            }
            $.each(obj, function (key, val) {
                if (val !== undefined && val !== null) {
                    result[key] = val;
                }
            });
            return result;
        },
        // 返回cookie对象
        getCookies: function () {
            var cookies = {}, i, all, list;
            all = document.cookie;
            if (all === "")
                return cookies;
            list = all.split("; ");
            for (i = 0; i < list.length; i++) {
                var cookie = list[i];
                var p = cookie.indexOf("=");
                var name = cookie.substring(0, p);
                var value = cookie.substring(p + 1);
                value = decodeURIComponent(value);
                cookies[name] = value;
            }
            return cookies;
        }, 
		tmpl: function(tpl, data) {
			var lpos, rpos, key, html = '', 
				lb = '<%=', rb = '%>', 
				llth = lb.length, rlth = rb.length;
			lpos = tpl.indexOf('<%=');
			if (lpos !== -1) {
				rpos = tpl.indexOf('%>', lpos + llth);
				key = tpl.slice(lpos + llth, rpos);
				html += tpl.slice(0, lpos) + ((data[key] === undefined) ? '' : data[key]);
				html += arguments.callee(tpl.slice(rpos + rlth), data);
			} else {
				html = tpl;
			}
			return html;
		}		
    });

    window.def = $.util.def;

})(jQuery);
