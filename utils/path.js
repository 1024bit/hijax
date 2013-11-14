(function($) {
    $.util.path = {
        /**
         * Parse a URL and return its components  
         * note: Based on http://stevenlevithan.com/demo/parseuri/js/assets/parseuri.js
         * note: blog post at http://blog.stevenlevithan.com/archives/parseuri
         * note: demo at http://stevenlevithan.com/demo/parseuri/js/assets/parseuri.js
         * note: Does not replace invalid characters with '_' as in PHP, nor does it return false with
         * note: a seriously malformed URL.
         * note: Besides function name, is essentially the same as parseUri as well as our allowing
         * note: an extra slash after the scheme/protocol (to allow file:/// as in PHP)
         * example 1: parse_url('http://username:password@hostname/path?arg=value#anchor');
         * returns 1: {scheme: 'http', host: 'hostname', user: 'username', pass: 'password', path: '/path', query: 'arg=value', fragment: 'anchor'}
         */
        resolve: function(str, component) {
            var key = ['source', 'scheme', 'authority', 'userInfo', 'user', 'pass', 'host', 'port', 
                                'relative', 'path', 'directory', 'file', 'query', 'fragment'],
                ini = (this.php_js && this.php_js.ini) || {},
                mode = (ini['phpjs.parse_url.mode'] && 
                    ini['phpjs.parse_url.mode'].local_value) || 'php',
                parser = {
                    php: /^(?:([^:\/?#]+):)?(?:\/\/()(?:(?:()(?:([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?()(?:(()(?:(?:[^?#\/]*\/)*)()(?:[^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                    loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/\/?)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/ // Added one optional slash to post-scheme to catch file:/// (should restrict this)
                };
         
            var m = parser[mode].exec(str),
                uri = {
                    scheme: '', 
                    host: '', 
                    hostname: '', 
                    domain: '', 
                    port: '', 
                    user: '', 
                    pass: '', 
                    path: '', 
                    file: '', 
                    query: '', 
                    fragment: ''
                },
                i = 14;
            while (i--) {
                if (m[i]) {
                  uri[key[i]] = m[i];  
                }
            }
         
            if (component) {
                return uri[component.replace('PHP_URL_', '').toLowerCase()];
            }
            if (mode !== 'php') {
                var name = (ini['phpjs.parse_url.queryKey'] && 
                        ini['phpjs.parse_url.queryKey'].local_value) || 'queryKey';
                parser = /(?:^|&)([^&=]*)=?([^&]*)/g;
                uri[name] = {};
                uri[key[12]].replace(parser, function ($0, $1, $2) {
                    if ($1) {uri[name][$1] = $2;}
                });
            }
            // hostname 
            uri.host && (uri.hostname = uri.host);
            // hostname:port
            uri.port && (uri.host = uri.host + ':' + uri.port);
            // http://username:password@hostname:port
            if (uri.scheme || uri.host) {
                uri.domain = (uri.scheme || 'http') + '://' + (uri.user ? (uri.user + ':' + uri.pass + '@') : '') + uri.host;
            }
            uri.file = uri.path.slice(uri.path.lastIndexOf('/') + 1);
            // delete uri.source;
            return uri;
        }, 
        // 添加url参数
        addQueries: function(url, queries) {
            if (!queries || $.isEmptyObject(queries)) return url;
            var u = this.resolve(url), l = url.indexOf('?'), 
                q, 
                f = u.fragment ? '#' + u.fragment : '';    
            u.query = $.util.unparam(u.query);
            queries = (typeof queries === "string") ? $.unparam(queries) : queries;
            q = decodeURIComponent($.param($.extend(true, {}, u.query, queries)));
            return url.substring(0, (l > -1) ? l : url.length) + '?' + q + f;
        }
    };
})(jQuery);