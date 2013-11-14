/*
 *  请求类: 合并请求; 模拟form请求
 */
$.hijax.requestQueue = {};
$.hijax.requestTimer = 0;
$.hijax.request = function(opts) {
	this.type = 'get'; // 默认get请求
	this.cnet = 'ajax'; //请求类型。取值："ajax","iframe"
	this.api = null; // api对象
	this.url = ''; // 请求地址
	this.data = null; // 请求传递的数据
	this.dataType = ''; // xml, html, text, json, script, jsonp
	this.success = ''; // 成功回调
	this.error = ''; // 失败回调
	this.cache = false; // 缓存
	this.timeout = $.hijax.requestTimeout; // 超时
	this.timeoutTimer = 0; // 超时侦测器
	this.iframe = null; // 目标iframe, 仅用于cnet为iframe, 若为空则动态创建
	this.iform = null; // 目标form, 仅用于cnet为iframe, 若为空则动态创建
	this.merge = {}; // 合并请求
	this.mergeKey = '';
	
	var _init = function(opts) {
		if (opts.url && !opts.api) {
			opts.api = {name: 'default', method: 'default'};
		}
		var api = $.hijax.apiMap[opts.api.name];
		if (api.url) {opts.url = api.url;}
		api = api['method'][opts.api.method];
		if (api.hasOwnProperty("mergeKey")){
			opts.mergeKey = api.mergeKey;
		}
		
		if (typeof(opts.data) == "function") {
			opts.data = opts.data();
		}
		if (typeof(opts.data) == "string") {
			opts.data = $.util.unparam(opts.data);
		}
		
		if (api.data) {
			opts.data = api.data(opts.data);
		}
		$.extend(this, opts);
	};
	_init.call(this, opts);
}
$.hijax.request.prototype = {
    resultCall: function(result){
        var i;
        if (this.timeoutTimer) {clearInterval(this.timeoutTimer);}
        if (result.state) {
            if (this.mergeKey === "") this.success(result.data);
            for (i in this.merge) this.merge[i].success(result.data[i]);
        } else {
            if (this.mergeKey === "") this.error(result.errors, result.data);
            for (i in this.merge) this.merge[i].error(result.errors, result.data);
        }
    },
    abort: function () {
        if (this.timeoutTimer) {clearInterval(this.timeoutTimer);}
        if (this.net) {
            if (this.net.abort) {
                this.net.abort();
            } else {
                this.net.src = "about:blank";
                $(this.net).triggerHandler('abort');
            }
        }
    }
};

// 工具-远程调用
$.util.rpc = function(opts) {
	var request, queue;
    request = new $.hijax.request(opts);
	if ($.hijax.requestQueue[request.url]) {
		if (!request.mergeKey) return false;
		$.hijax.requestQueue[request.url].merge[request.mergeKey] = request;
		request = $.hijax.requestQueue[request.url];
    } else {
		// 第一个请求
		request.merge[request.mergeKey] = request;
		$.hijax.requestQueue[request.url] = request;
    }
	var _sendRequest = function(request) {
		var i, merge = '', isJsonp, jsonp;
		for (i in request.merge) {
			merge += '&' + $.hijax.requestMergeKey + '[]=' + request.merge[i].mergeKey;
			// 合并数据
			$.extend(request.data, request.merge[i].data);
			request.iframe = request.iframe || request.merge[i].iframe;
			request.iform = request.iform || request.merge[i].iform;
		}
		// 假设所有请求参数相同
		request.url = request.url + ((request.url.indexOf('?') > -1) ? '' : '?') + ((request.type == 'get' && request.data) ? '&' + $.param(request.data) : '') + ((merge !== '') ? merge : '');
		// 合法外域, 默认使用jsonp
		if ($.util.path.isPermittedCrossDomainRequest(request.url)) isJsonp = true;
		if (isJsonp) {
			request.dataType = 'jsonp';
			request.type = 'get';
			jsonp = $.hijax.requestJsonpKey;
		}
		isJsonp = request.dataType == 'jsonp';
		// 目前强行禁止iframe方式; 是否去除iframe代码块(尚未测试), 有待考察
		request.cnet = 'ajax';
		if (request.cnet == "iframe") {
			var _iframeCallBack, _ajaxJsonp, _callback, key, timeBegin, event, src, html, post, dataType = request.dataType || 'html', 
				blankRE = /^\s*$/, jsonpId = 0;
			
			if (!request.cache) {
				// cnet == 'ajax', 默认会执行此操作
				request.url = request.url + "&_=" + (+new Date());
			}
			
			_iframeCallBack = function(r){
				// 移除DOM对象的同时, 请移除DOM对象对于JS对象的引用, 以免在某些浏览器造成内存泄露
				this.onload = null;
				this.onreadystatechange = null;
				this.abort = null;
				// 此处为何延迟100ms?
				setTimeout(function () {
					$(r.net).remove();
					if (r.netForm) {
						$(r.netForm).remove();
					}
					r.netForm = null;
					r.net = null;
				}, 100);
			};
			
			_ajaxJsonp = function(){
				var callbackName = 'jsonp' + (++jsonpId);
				window[callbackName] = function(data) {
					clearTimeout(abortTimeout);
					delete window[callbackName];
					return data;
				}
			};
			
			_callback = function(result) {
				var api = $.hijax.apiMap[request.api.name][request.api.method];
				if (result.state && api.success) {result.data = api.success(result.data);}
				if (!result.state && api.error) {result.data = api.error(result.data);}
				
				request.resultCall(result);
				_iframeCallBack.call(this, request);				
			};
			
			// 非法域
			if (!$.util.path.isPermittedDomainRequest(request.url)) {
				var result = new $.hijax.result();
				result.setErrors([{tid:'framework', id:'crossDomain'}]);
				_callback(result);
				return;
			}
			
			if (!request.iframe) {
				request.net = document.createElement("iframe");
				request.net.style.display = "none";
				request.net.id = "cnet_iframe_" + $.util.autoId();
				request.net.name = request.net.id;
				document.appendChild(request.net);
				// ie hack
				window.frames[request.net.id].name = request.net.id; 
			} else {
				request.net = request.iframe;
			}
			
			request.net.abort = function (e) {
				var result = new $.hijax.result();
				result.setErrors([{tid:'framework', id:'requestAbort'}]);
				_callback(result);
			};
			
			// 兼容写法
			request.net.onload = request.net.onreadystatechange = function (e) {
				var data, result, api;
				if (this.readyState && this.readyState != "complete") {
					return false;
				}
				
				// 返回数据类型
				data = this.contentWindow.document.body.innerHTML;
				try {
					if (dataType == 'script' || dataType == 'jsonp') eval(data);
					else if (dataType == 'xml') data = $.parseXML(data);
					else if (dataType == 'json') data = blankRE.test(data) ? null : eval('(' + data + ')');;
				} catch (e) {
					result = new $.hijax.result();
					result.setErrors([{tid: 'framework', id: 'resultDecodeError'}]);
					_callback(result);
					return;
				}				
				result = new $.hijax.result(data);
				_callback(result);
			};
			
			src = request.url + (isJsonp ? '&' + (jsonp || 'callback') + '=?' : '') + '&__=iframe';
			if (isJsonp) {
				src = src.replace(/=\?/, '=' + callbackName);
				_ajaxJsonp();
			}
			
			if (request.type == "post") {
				post = request.data;
				if (!request.iform) {
					request.netForm = document.createElement("form");
					request.netForm.target = request.net.id;
					request.netForm.style.display = "none";
					html = '';
					for (key in post) {
						html += '<input type="hidden" name="' + key + '" value="' + post[key] + '"/>';
					}
					request.netForm.innerHTML = html;
					document.appendChild(request.netForm);
				} else {
					request.netForm = request.iform;
					html = '';
					for (key in post) {
						if (request.netForm[key] && request.netForm[key].nodeName) {
							request.netForm[key].value = post[key];
						} else {
							html += '<input type="hidden" name="' + key + '" value="' + post[key] + '"/>';
						}
					}
					if (html != "") {
						request.netForm.innerHTML += html;
					}
				}

				request.netForm.action = src;
				request.netForm.method = "post";
				request.netForm.target = request.net.name;
				event = $.Event('submit');
				$(request.netForm).trigger(event);
				if (!event.isDefaultPrevented()) request.netForm.submit();				
				request.netForm.submit();
			} else {
				request.net.src = src;
			}
			
			// 超时策略: 溢出; 可根据实际情况配置策略
			if (request.timeoutTimer) {clearInterval(request.timeoutTimer);}
			timeBegin = new Date().getTime();
			request.timeoutTimer = setInterval(function(){
				var time = new Date().getTime();
				if ((time - timeBegin) > request.timeout) {request.abort();}
			}, 1000);
			
		} else {
			var ajaxSettings = {
				type: request.type, 
				url: request.url + "&__=ajax", 
				data: request.data, 
				dataType: request.dataType, 
				timeout: request.timeout, 
				cache: request.cache,
				success: function (data, textStatus) {
					var result, api;
					result = new $.hijax.result(data);
					api = $.hijax.apiMap[request.api.name]['method'][request.api.method];
					
					if (result.state && api.success) {result.data = api.success(result.data);}
					if (!result.state && api.error) {result.data = api.error(result.data);}
					request.resultCall(result);
				},
				error: function (xhr, textStatus, errorThrown) {
					var result, api;
					//textStatus:"success", "notmodified", "error", "timeout", "abort", or "parsererror"
					result = new $.hiajx.result();

					result.setErrors([{tid:'framework', id:'remoteError'}]);

					api = $.hijax.apiMap[request.api.name][request.api.method];
					if (result.state && api.success) {result.data = api.success(result.data);}
					if (!result.state && api.error) {result.data = api.error(result.data);}
					request.resultCall(result);
				}
			};
			isJsonp && (ajaxSettings.jsonp = jsonp);
			ajaxSettings = $.extend({}, opts, ajaxSettings);
			request.net = $.ajax(ajaxSettings);
		}		
	};
    if (!$.hijax.requestTimmer){
        $.hijax.requestTimmer = setTimeout(function(){
            var i;
            $.hijax.requestTimmer = 0;
            for (i in $.hijax.requestQueue){
                _sendRequest($.hijax.requestQueue[i]);
            }
            $.hijax.requestQueue = {};
        }, $.hijax.requestMergeTime);
    }
    return request;	
}