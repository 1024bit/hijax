(function ($) {
    // 定制script请求
    $.ajaxTransport("+script", function(s) {
        if (s.crossDomain) {
            var sid = 'script' + (++$.guid);
            return {
                send: function(_, callback) {
                    window.scriptReady = function(script, isAbort) {
                        if (isAbort || !script.readyState || /loaded|complete/.test(script.readyState)) {
                            window.scriptReady = null;
                            // 防止IE内存泄露的标准操作
                            script.onreadystatechange = script.onload = null;
                            if (script.parentNode) {
                                script.parentNode.removeChild(script);
                            }                            
                            script = null;
                            
                            if (!isAbort) {
                                callback(200, "success");
                            }
                        }
                    };
                    document.write('<script type="text/javascript" id="' + sid + '" src="' + s.url + '" onload="scriptReady(this);" onreadystatechange="scriptReady(this);"></script>');
                },
                abort: function() {
                    if (window.scriptReady) {
                        window.scriptReady($('#' + sid).get(0), true);
                    }
                }
            };
        }
    });

    // 加载配置, 考虑是否支持元数据($.metadata)
	var $script = $('script[data-hijax-config]').first(), 
		confUrl = $script.data('hijax-config');

    if (confUrl) {
        $.Deferred(function(deferred) {
            $.ajax({
                url: confUrl,
                crossDomain: true, 
                dataType: 'script'
            }).done(function() {
                deferred.resolve();
                return deferred.promise();
            })
            
        }).done(_frameInit);
    } else {
        _frameInit();
    }

    function _frameInit() {
		var $win = $(window),
			$doc = $(document),
			$base = $('base'),
			path = $.util.path,
			baseUrl,
			debug = $.hijax.debug,
			_remove = $.fn.remove,
			_MD5 = $.util.MD5,
			_resolve = path.resolve;
			
		/**
		* 扩展$.fn对象
		*/
		$.extend($.fn, {
			// 可停止冒泡的trigger
			_trigger: function () {
				var 
				args = [].slice.apply(arguments), 
				lstarg = args[args.length - 1], 
				bubble = ($.type(lstarg) !== 'boolean') && lstarg;
				return bubble ? $.fn.trigger.apply(this, args) : $.fn.triggerHandler.apply(this, args);
			},
			// 获取元素html
			outerHtml: function () {
				var outerHtml = '';
				if (this.outerHTML || false) {
					return this.outerHTML;
				}
				var $div = $('<div/>');
				$div[0].appendChild(this.clone(true)[0]);
				outerHtml = $div[0].innerHTML;
				$div[0] = null;
				return outerHtml;
			},
			pageOffset: function () {
				var offset = this.offset();
				return {
					top: offset.top + $win.scrollLeft(),
					left: offset.left + $win.scrollTop()
				};
			}, 
			// 修正DOM不能释放
			remove: function (selector, keepData) {
				_remove.call(this, selector, keepData);
				var div = $('<div/>')[0];
				this.each(function () {
					div.appendChild(this);
					div.innerHTML = '';
				});
				div = null;
				return this;
			},
			// 修正iframe内存泄露
			purgeFrame: function () {
				var deferred,
					purge = function ($frame) {
						var sem = $frame.length,
							_deferred = $.Deferred();

						$frame.load(function () {
							var frame = this;
							frame.contentWindow.document.innerHTML = '';

							sem -= 1;
							if (sem <= 0) {
								$frame.remove();
								_deferred.resolve();
							}
						});
						$frame.attr('src', 'about:blank');

						if ($frame.length === 0) {
							_deferred.resolve();
						}

						return _deferred.promise();
					};

				if ($.browser.msie && parseFloat($.browser.version, 10) < 9) {
					deferred = purge(this);
				} else {
					this.remove();
					deferred = $.Deferred();
					deferred.resolve();
				}

				return deferred;
			}
		});			
			
        // 确保域名, 不带尾斜线
        if ($.hijax.domain.lastIndexOf('/') === $.hijax.domain.length - 1) {
            $.hijax.domain = $.hijax.domain.slice(0, -1);
        }
        $.hijax.domain = $.hijax.domain || ('http://' + location.host);
        !$.hijax.moduleContainer.length && ($.hijax.moduleContainer = $doc);
        
        $.extend($.hijax, {
            version: '1.1.1', 
            win: $win,
            doc: $doc, 
            // 某些别名指向站点根目录; 如, /alias
            alias: ($.hijax.domain !== 'http://' + location.host) ? $.hijax.domain.slice($.hijax.domain.lastIndexOf('/')) : '', 
            modules: {}, 
            cache: {}, 
            // jQuery原生ajax
            _ajax: $.ajax,
            // 匹配具体模块目录
            nodeRE: function(url) {
				/(([\w\-_]+?)[.\/])?([\w\-_]+?)(([?&])(.+?))?$/.test(url);
				return {mNode: RegExp.$2, node: RegExp.$3, connector: RegExp.$5, queries: RegExp.$6};
			}, 
            activeLink: [],
            setHash: function (val) {
                location.hash = val;
            },
            getHash: function () {
                return location.hash.slice(1);
            },
            // 批量修改组件配置
            widgetSetup: function (widgetName, options) {
                $.extend(true, $.hijax[widgetName].prototype.options, options);
            }    
        });

		// 工具对象缩写
        ($.type(U) !== 'undefined') && $.extend($.util, U);
        window.U = $.util;

        // 初始化模块业务逻辑
        $.hijax.createModule = function (options) {
            var opts = {}, older, 
                evtobj = null,
                tuples = ['tplEngine', 'dataApi', 'keepState', 'template', 'data', 'params', 'tplData', 'title', 'commData'];

            options = $.extend(true, {}, options);
            older = $.extend(true, {}, options);
            
            $.map(tuples, function (tuple) {
                if (options[tuple] !== undefined || options[tuple] !== null) {
                    opts[tuple] = options[tuple];
                    delete options[tuple];
                }
            });

            evtobj = {
                'moduleinit': function (event, data) {
					var 
                    self = this, key, 
                    custom = options.destroy, 
                    older = this.destroy;
                    
                    if (custom) {
                        options.destroy = function() {
                            older.apply(self, arguments);
                            custom.apply(self, arguments);
                        };
                    }             
                    $.extend(this, options);
                    if (!this.options.changeModule) {
                        if ($.hijax.activeModule) {
                            window.P = $.hijax.activeModule.data('hijax-module');
                        } else {
                            window.P = this;
                        }
                    } else {
                        window.P = this;
                    }

                    window.M = $.hijax.modules;

                    if (this.init) {
                        $.hijax.moduleinit.call(this);
                        try {
                            this.init(data);
                        } catch (error) {
                            echo(error);
                        }
                        /*
                        // 模块准备就绪, 触发ready.remove事件
                        this.ready = true;
                        this._trigger('ready.remove');
                        */
                    }
                    
                }
            };
            if (!$.isEmptyObject(opts)) {

                evtobj['modulecreate'] = function () {
                    // 按来源划分配置项优先顺序, 依次为: loadModule, creatModule, data-metadata
                    opts = (this.options.prior) ?
                        $.extend(true, {}, opts, $.util.compact(this.options)) :
                        $.extend(true, {}, $.util.compact(this.options), opts);
                    
                    this.option(opts);
                    $.extend(true, this, opts);
                };
            }
            $.hijax.latestLoadedModule.on(evtobj);
            if (!$.hijax.dev) {
                var 
                _cache = $.hijax.cache, 
                _id = $.hijax.latestLoadedModule.attr('uid');
                
                if (!_cache[_id]) {
                    _cache[_id] = older;
                }
            }
        };

        window.echo = function (o) {
            console.log(o);
        };
        // 不支持console.log的浏览器, 静默
        if (!debug || !window.console) {
            window.echo = function () {
                // do nothing
            };
        }

        if (document.uniqueID && !window.XMLHttpRequest) {
            try {
                // IE6下改变样式, 可能会重新下载背景图片, 引起光标忙的式样		
                document.execCommand("BackgroundImageCache", false, true);
            } catch (e) {
            }
        }

        /**
        * 扩展$.util对象
        */
        $.extend($.util, {
            MD5: (function () {
                var memory = {};
                return function (str) {
                    if (!memory[str])
                        memory[str] = _MD5(str);
                    return memory[str];
                };
            })()
        });
        // 扩展path对象
        $.extend(path, {
            resolve: (function () {
                var memory = {}, u;

                return function (str, component) {
                    if (!memory[str]) {
                        u = _resolve(str, component);
                        u.domain = u.domain + $.hijax.alias;
                        if ($.hijax.alias) {
                            if (!u.path.indexOf($.hijax.alias)) {
                                u.path = u.path.slice($.hijax.alias.length);
                            }
                        }
                        memory[str] = u;
                    }
                    return memory[str];
                };
            })(),
            // 资源绝对地址
            getAbsoluteUrl: function (u, r) {
                var s = (u.query ? '?' + u.query : '') + (u.fragment ? '#' + u.fragment : ''),
                    p1 = u.path,
                    p2 = r.path,
                    p,
                    key;

                // ''
                p1 = p1 ? p1.replace(/^\//, '').split('/') : [];
                p2 = p2 ? p2.replace(/^\//, '').split('/') : [];

                for (key in p1) {
                    if (p1[key] === '.') p1.splice(key, 1);
                }
                $.each(p1, function () {
                    p2.splice(p2.length - 1, 1);
                });

                p = p2;
                $.each(p1, function (k, v) {
                    if (v === '..') return;
                    p.push(v);
                });

                return r.domain + '/' + p.join('/') + s;
            },
            // 资源相对地址
            getRelativeUrl: function (u) {
                if (this.isSameDomain(u, baseUrl)) {
                    return u.source.replace(baseUrl.domain, "");
                }
                // 外域
                return decodeURIComponent(u.source);
            },
            // 合法外域
            isPermittedCrossDomainRequest: function (u) {
                if (this.isSameDomain(u, baseUrl)) return false;
                var crossDomainList = $.hijax.accessControlAllowOrigin;
                var _domain = ($.hijax.alias) && u.domain.slice(0, -$.hijax.alias.length);
                return crossDomainList === '*' || (crossDomainList !== '' && ($.inArray(_domain, crossDomainList) > -1));
            },
            // 合法域
            isPermittedDomainRequest: function (u) {
                return this.isSameDomain(u, baseUrl) || this.isPermittedCrossDomainRequest(u);
            },
            // 关联本地应用, 如: mailto:, tel:
            isLocalUrlScheme: function (u) {
                var schemes = ['http:', 'https:'];
                return (~$.inArray(u.scheme, schemes)) ? true : false;
            },
            // 相对地址
            isRelative: function (u) {
                return !u.domain || (u.domain === $.hijax.alias);
            },
            // 外域
            isExternal: function (u) {
                if (this.isRelative(u)) return false;
                return u.domain !== baseUrl.domain ? true : false;
            },
            // 同域
            isSameDomain: function (u1, u2) {
                if (this.isRelative(u1)) return true;
                return u1.domain === u2.domain;
            }
        });
        baseUrl = $base.length ? path.resolve($base.attr('href')) : path.resolve(location.href);
        $.hijax.baseUrl = baseUrl;
        $.hijax.homePage = path.getRelativeUrl(path.resolve(location.href));

        // 自定义选择器
        $.expr[':'].hijax = function (elem) {
            return path.isPermittedDomainRequest(path.resolve(elem.href || elem.src || elem.action));
        };

        // 拦截链接; 给大量的链接直接绑定事件将会增加内存泄露的风险
        $doc.on("click menuselect", 'a, button', function (event) {
            // 右键
            if (event.which > 1 || event.metaKey) {
                return;
            }

            var $link = $(event.target),
                href,
                tagName = $link[0].tagName.toLowerCase(), 
				aTag = (tagName === 'a'), opts = {}, 
                baseUrl = window.location.href;
               
            /*
            if (! ~$.inArray(tagName, ['a', 'button'])) {
                // $link = $link.closest('a:hijax:not([hijax="false"]):not([target])');
                $link = $link.closest('a');
            }
			*/

            // 非链接
            // if (!$link.length || $link.is('[hijax="false"]') || $link.attr('target')) {
            if ($link.is('[hijax="false"]') || $link.attr('target')) {
                return;
            }

            /*
            // 防止重复点击
            if ($.hijax.activeLink && ($.hijax.activeLink[0] === $link[0])) {
            event.preventDefault();
            return;
            }
            */
        
            // !href针对button
			/*
            if (tagName === 'button') {
                return;
            }
			*/
            // IE8以下, href="#" 将返回http://yourdomain#
			// 该bug已在新的jQuery版本中修复
            // 考虑<a></a>
            href = $link.attr('href') || '';
            // href = href.split(baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1)).pop();
            if (!href || ~href.indexOf('#') || !href.indexOf('javascript:')) {
                aTag && event.preventDefault();
                return;
            }
            
            $link
                .attr('disabled', true)
                .attr('aria-disabled', true)
                .addClass($.hijax.disabledLinkClass);

            ($.inArray($link[0], $.hijax.activeLink) < 0) && $.hijax.activeLink.push($link);
			
            // href = href || $link.attr("href");
            // 使用ajax
            aTag && event.preventDefault();

			switch ($link.attr('type')) {
				case 'back':
					opts.isParentModule = true;
					break;
				case 'reload':
					opts.reload = true;
					break;
				default:
					if ($link.closest('[widget=module]').length) opts.isSubModule = true;
					break;
			}
            $.hijax.changeModule(href, opts);
        });

        // 拦截未被阻止掉的表单请求
        $doc.on("submit", "form", function (event) {
            var $this = $(this);
            if ($this.is('[hijax="false"]')) return;

            /*
            var type = $this.attr("method"),
            url = $this.attr("action");
            changeModule(url, {
            type: type || "post", 
            data: $this.serialize(), 
            });
            */
            event.preventDefault();
        });

        // 兼容写法
        window.onerror = function () {
            return $.hijax.ignoreError;
        };

        // 不建议针对$.ajax做过多包装; 保留此段代码目的: 向后兼容
        $.ajax = function (opts) {
			opts.context = opts;
            opts.url = path.getAbsoluteUrl(path.resolve(opts.url), baseUrl);
            return $.hijax.appCacheEnabled ?
                $.hijax.appCache.fetch(opts) :
                (window.P || $.hijax).rpc(opts);
        };

        if ($.hijax.historyEnabled) {
            /**
            * 前进或后退触发
            * 引入https://github.com/balupton/history.js的过程中, 发生了严重的内存泄露
            * 转而使用https://github.com/cowboy/jquery-hashchange
            */
            $win.on({

                hashchange: function (event, preventDefault) {
                    echo('prevent hashchange: ' + preventDefault);
                    
                    if (preventDefault) return;

                    var url = $.hijax.getHash();
                    url && $.hijax.changeModule(url, { push: false });
                }
            });
        }

		/*
        $(function() {
        /\/([^\/]+?)\/([^(.|\/)]+?)(\.\w+?)?(\?|$)/i.test(location.pathname);
        var mNode = RegExp.$1, node = RegExp.$2;
        $.util.getScript($.hijax.domain + $.hijax.controllersPath + '/' + mNode + '/' + node + '.js');
        });
        */
    }
})(jQuery);