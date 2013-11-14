/**
 * 请求类
 * 1. 合并请求
 * 2. 模拟iframe, form请求
 */
(function ($) {
    $.hijax.requestInstances = [];
    $.hijax.requestQueue = {};
    $.hijax.requestTimer = 0;
    $.hijax.request = function (opts) {
		var self = this;
        this.proxy = 1; // 使用代理缓存
        this.cnet = 'ajax'; //请求类型。取值："ajax", "iframe", "form"
        this.api = ''; // api: sina.news.getNews
        this.data = null; // 请求传递的数据
        this.success = $.noop; // 成功回调
        this.error = $.noop; // 失败回调
        this.timeout = $.hijax.requestTimeout; // 超时
        this.timeoutTimer = 0; // 超时侦测器
        this.iframe = null; // 目标iframe, 仅用于cnet为iframe, 若为空则动态创建
        this.form = null; // 目标form, 仅用于cnet为form, 若为空则动态创建
		this.submit = $.noop; // 侦听表单submit事件
        this.merge = {}; // 合并请求: 同一请求, 在预定时间内携带不同参数
        this.mergeKey = '';
        this.context = this;
		
        var _init = function (opts) {
			if (opts.api) {
				opts.api = opts.api.split(/[.\/]/);
				if (opts.api.length === 2) {
					opts.api.unshift('default');
				}
				
				if (opts.api.length === 3) {
					var api = $.hijax.apiMap[opts.api[0]];
					if (api.url) { opts.url = api.url; }

					var method = api[opts.api[1]][opts.api[2]];
					if (method.hasOwnProperty("mergeKey")) {
						opts.mergeKey = method.mergeKey;
					}
					if (method.data) {
						opts.data = method.data(opts.data);
					}				
				}
			}
			
			if (!opts.url) {
				echo('请求地址为空');
				return;
			}			

            if (typeof (opts.data) == "function") {
                opts.data = opts.data();
            }
            if (typeof (opts.data) == "string") {
                opts.data = $.util.unparam(opts.data);
            }
			// 同步ajax全局设置
            $.extend(this, {type: $.ajaxSettings.type}, opts);
        };
        _init.call(this, opts);
		
		return $.Deferred(function(deferred) {
			function _callback(pattern, replacement) {
				var fn = self[pattern];
				self[pattern] = function() {
					var args = [].slice.call(arguments, 0);
					fn.apply(self.context, args);
					deferred[replacement].apply(self.context, args);
				}
			}
			_callback('success', 'resolve');
			_callback('error', 'reject');
			$.extend(deferred, self);
		});
    };
    $.hijax.request.prototype = {
        resultCall: function (result, textStatus, xhr) {
            var i, args;
            if (this.timeoutTimer) { 
				clearInterval(this.timeoutTimer); 
				this.timeoutTimer = 0;
			}
            if (result.status == 1) {
                if (this.mergeKey === "") {
                    try {
                        this.success.call(this.context || this, result.data, textStatus, xhr);
                    } catch (error) {
						echo(error.message)
                        // echo('请求' + xhr.url + '未被溢出!');
                        // do nothing
                    }
                }
                for (i in this.merge) {
                    try {
                        this.merge[i].success.call(this.context || this, result.data[i]);
                    } catch (error) {
                        // do nothing
                    }
                }
            } else if (result.status === 0) {
                args = [].slice.call(arguments, 1);
                if (this.mergeKey === "") {
                    this.error.apply(this.context || this, args);
                }
                for (i in this.merge) {
                    this.merge[i].error.apply(this.context || this, args);
                }
            }
        },
        abort: function () {
            if (this.timeoutTimer) { 
				clearInterval(this.timeoutTimer); 
				this.timeoutTimer = 0;
			}
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
    $.hijax.rpc = function (opts) {
        var request;
        request = new $.hijax.request(opts);
        $.hijax.requestInstances.push(request);
		// 运用场景 
        if ($.hijax.requestQueue[request.url]) {
            if (!request.mergeKey) return false;
            $.hijax.requestQueue[request.url].merge[request.mergeKey] = request;
            request = $.hijax.requestQueue[request.url];
        } else {
            // 第一个请求
            request.mergeKey && (request.merge[request.mergeKey] = request);
            $.hijax.requestQueue[request.url] = request;
        }
        var _sendRequest = function (request) {
            var 
            i, merge = [], isJsonp, jsonp, queries = {}, 
            type = request.type.toLowerCase(), 
            cache = request.cache || $.ajaxSettings.cache;
            
            for (i in request.merge) {
                merge.push(request.merge[i].mergeKey);
                // 合并数据
                $.extend(request.data, request.merge[i].data);
                request.iframe = request.iframe || request.merge[i].iframe;
                request.form = request.form || request.merge[i].form;
            }

            // merge += '&' + $.hijax.requestMergeKey + '[]=' + request.merge[i].mergeKey; php风格
			merge.length && (request.data[$.hijax.requestMergeKey] = merge.join(','));
            if (type === 'get' && request.data) {
                $.extend(queries, request.data);
                request.data = null;
            }
            // Setting cache to false will only work correctly with HEAD and GET requests.
            (type === 'post' && !cache) && (queries['_'] = +new Date());
            request.url = $.util.path.addQueries(request.url, queries);

            // 合法外域, 默认使用jsonp, 外域返回格式不限于jsonp
            if ($.util.path.isPermittedCrossDomainRequest(request.url)) isJsonp = true;
            if (isJsonp) {
                request.dataType = 'jsonp';
                request.type = 'get';
                jsonp = $.hijax.requestJsonpKey;
            }
            isJsonp = request.dataType == 'jsonp';
			
			if (request.cnet === "iframe") {
				var 
				key, timeBegin, src, html, postData, dataType = request.dataType || 'html', 
				blankRE = /^\s*$/, jsonpId = 0, 
				_iframeCallBack = function(r) {
					// 移除DOM对象的同时, 请移除DOM对象对于JS对象的引用, 以免在某些浏览器造成内存泄露
					this.onload = null;
					this.onreadystatechange = null;
					this.abort = null;

					setTimeout(function () {
						$(r.net).remove();
						if (r.netForm) {
							$(r.netForm).remove();
						}
						r.netForm = null;
						r.net = null;
					}, 0);
				}, 
				_ajaxJsonp = function(callbackName) {
					window[callbackName] = function(data) {
						clearTimeout(abortTimeout);
						delete window[callbackName];
						return data;
					}
				},
				_callback = function(result) {
					if (request.api) {
						var api = $.hijax.apiMap[request.api[0]][request.api[1]][request.api[2]];
						if (result.state && api.success) {result.data = api.success(result.data);}
						if (!result.state && api.error) {result.data = api.error(result.data);}
					}
					request.resultCall(result);
					_iframeCallBack.call(this, request);				
				};
				
				if (!request.cache) {
					// cnet == 'ajax', 默认会执行此操作
					request.url = request.url + "&_=" + (+new Date());
				}
				
				// 非法域; cnet == 'ajax', 在框架层有判断
				if (!$.util.path.isPermittedDomainRequest(request.url)) {
					var result = new $.hijax.result();
					result.setErrors([{tid:'framework', id:'crossDomain'}]);
					_callback(result);
					return;
				}
				
				if (!request.net) {
					request.net = document.createElement("iframe");
					request.net.style.display = "none";
					request.net.id = "cnet_iframe_" + (++$.guid);
					request.net.name = request.net.id;
					document.appendChild(request.net);
					request.iframe = request.net;
					// ie hack
					window.frames[request.net.id].name = request.net.id; 
				} 
				
				request.net.abort = function (e) {
					var result = new $.hijax.result();
					result.setErrors([{tid:'framework', id:'requestAbort'}]);
					_callback(result);
				};
				
				// 兼容写法
				request.net.onload = request.net.onreadystatechange = function (e) {
					var data, result;
					if (this.readyState && this.readyState != "complete") {
						return false;
					}
					
					// 返回数据类型
					data = this.contentWindow.document.body.innerHTML;
					try {
						if (dataType == 'script' || dataType == 'jsonp') eval(data);
						else if (dataType == 'xml') data = $.parseXML(data);
						else if (dataType == 'json') data = blankRE.test(data) ? null : eval('(' + data + ')');
					} catch (e) {
						result = new $.hijax.result();
						result.setErrors([{tid: 'framework', id: 'resultDecodeError'}]);
						_callback(result);
						return;
					}				
					result = new $.hijax.result(data);
					_callback(result);
				};
				
				src = request.url + '&__=iframe';
				if (isJsonp) {
					var callbackName = 'jsonp' + (++jsonpId);
					src += '&' + (jsonp || 'callback') + '=' + callbackName;
					_ajaxJsonp(callbackName);
				}				
				if (request.type === "post") {
					postData = request.data;
					if (!request.form) {
						request.netForm = document.createElement("form");
						request.netForm.target = request.net.id;
						request.netForm.style.display = "none";
						html = '';
						for (key in postData) {
							html += '<input type="hidden" name="' + key + '" value="' + postData[key] + '"/>';
						}
						request.netForm.innerHTML = html;
						document.appendChild(request.netForm);
					} else {
						request.netForm = request.form;
						html = '';
						for (key in postData) {
							if (request.netForm[key] && request.netForm[key].nodeName) {
								request.netForm[key].value = postData[key];
							} else {
								html += '<input type="hidden" name="' + key + '" value="' + postData[key] + '"/>';
							}
						}
						if (html != "") {
							request.netForm.innerHTML += html;
						}
					}

					request.netForm.action = src;
					request.netForm.method = "post";
					request.netForm.target = request.net.name;
					$(request.netForm).submit(function(e) {
						if (!(e instanceof $.Event)) { 
							e = $.Event(e);
						}
						return !e.isDefaultPrevented() && request.submit.apply(request.netForm, arguments);
					});					
				} else {
					request.net.src = src;
				}
				
				// 超时策略: 溢出; 可根据实际情况配置策略
				// cnet == 'ajax', 由timeout配置
				if (request.timeoutTimer) {
					clearInterval(request.timeoutTimer);
					request.timeoutTimer = 0;
				}
				request.timeoutTimer = setInterval(function(){
					request.abort();
				}, request.timeout);
			 
			} else {			
				var isFormSubmit = (request.cnet === "form"), $form, event, ajaxSettings;
				ajaxSettings = {
					type: request.type,
					url: request.url,
					data: request.data,
					timeout: request.timeout,
					context: request.context,
					success: function (data, textStatus, xhr) {
						var result = new $.hijax.result(data, xhr.status);
						if (request.api) {
							var api = $.hijax.apiMap[request.api[0]][request.api[1]][request.api[2]];
							if (result.status && api.success) {
								result.data = api.success(result.data);
							}
							if (!result.status && api.error) {
								result.data = api.error(result.data);
							}
						}
						
						// request.resultCall(result, textStatus, xhr);
						request.readyState = 4;
						request.resultCall(result, textStatus, request);
					},
					error: function (xhr, textStatus, errorThrown) {
						// textStatus: "success", "notmodified", "error", "timeout", "abort", or "parsererror"					
						var result = new $.hijax.result();
						result.setErrors([{ tid: 'framework', id: 'remoteError'}]);
						if (request.api) {
							var api = $.hijax.apiMap[request.api[0]][request.api[1]][request.api[2]];
							if (!result.status && api.error) {
								result.data = api.error(result.data);
							}
						}
						request.resultCall(result, request, textStatus, errorThrown);
					}, 
					complete: function(xhr, textStatus) {
						if (request.complete) request.complete.apply(request.context || request, [request, textStatus]);
						var idx = $.inArray(request, $.hijax.requestInstances);
						$.hijax.requestInstances.splice(idx, 1);
					}
				};
				isJsonp && (ajaxSettings.jsonp = jsonp);

				if (!request.proxy) {
					var _beforeSend = request.beforeSend, rtn;
					ajaxSettings.beforeSend = function(xhr) {
						if (_beforeSend) {
							rtn = _beforeSend.apply(this, arguments);
						}
						
						xhr.setRequestHeader('Cache-Control', 'private, max-age=0, no-store');
						xhr.setRequestHeader('Pragma', 'no-cache');
						xhr.setRequestHeader('Expires', -1);
						return rtn;
					}
					// request.cache = !request.cache;
				}
				
				// ajaxSettings = $.extend({}, opts, ajaxSettings);
				// 适应重写后$.ajax的context指向
				ajaxSettings = $.extend(opts, ajaxSettings);
				if (isFormSubmit) {
					$(request.form).ajaxSubmit(ajaxSettings);
				} else {
					request.net = $.hijax._ajax(ajaxSettings);
					$.each(request.net, function(key) {
						if (request[key] === undefined) {
							request[key] = request.net[key];
						}
					});
				}
			}
        };

        if (!$.hijax.requestTimer) {
            var i, now = +new Date(), elapsed;
            elapsed = now - $.hijax.requestTimer;
            $.hijax.requestTimer = now;
            if (elapsed >= $.hijax.requestMergeTime) {
                $.hijax.requestTimer = 0;
                for (i in $.hijax.requestQueue) {
                    _sendRequest($.hijax.requestQueue[i]);
                }
                $.hijax.requestQueue = {};
            }
            /*
            异步操作
            $.hijax.requestTimmer = setTimeout(function(){
            var i;
            $.hijax.requestTimmer = 0;
            for (i in $.hijax.requestQueue) {
            _sendRequest($.hijax.requestQueue[i]);
            }
            $.hijax.requestQueue = {};
            }, $.hijax.requestMergeTime);
            */
        }
        return request;
    };
})(jQuery);