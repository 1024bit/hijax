(function ($) {
    var 
    $win = $.hijax.win,
    $doc = $.hijax.doc,
    $head = $('head'),
    $title = $('title', $head),
    $activeLink = null,
    isModuleChanging = false,
    moduleChangeQueue = [],
    cnet = [],
	deferred, 
    path = $.util.path,
    baseUrl = $.hijax.baseUrl,
    /*
    scrollOptions = {
    duration: 800, 
    easing: 'swing'
    }, 
    */
    _abort = function() {
        // 溢出
        $.each(cnet, function() {
            if (this.net) {
                this.abort();
            } else {
                $.hijax.appCache.abort(this);
            }
        });
        cnet = [];            
    }, 
    // 屏幕解锁
    _unfreeze = function () {
        isModuleChanging = false;       
		if(moduleChangeQueue.length) {
			changeModule.apply(null, moduleChangeQueue.pop());
		}        
    },
    // 生成html实体
    _encodeTitle = function (title) {
        return title.replace('<', '&lt;').replace('>', '&gt;').replace(' & ', ' &amp; ');
    },
    // 移除激活链接焦点
    _blurActiveLink = function () {
        $activeLink = $.hijax.activeLink;
        var len = $activeLink.length;
        if (len) {
            $.each($activeLink, function () {
                this.attr('disabled', false)
                    .attr('aria-disabled', false)
                    .removeClass($.hijax.disabledLinkClass);
            });
            $activeLink[len - 1].blur();
            $.hijax.activeLink = [];
        }
        $activeLink = null;
    },
    
    /**
    * 负责模块显示或隐藏动画, 可根据需求增加适配器
    * 支持事件: modulehide, moduleshow
    */
    _transitionModules = function (toModule, fromModule) {
        var deferred = $.Deferred();
        // hideLoadMsg();
        fromModule && fromModule.data("hijax-module")._trigger("hide");
        toModule.data("hijax-module")._trigger("show");
        deferred.resolve(toModule, fromModule);
        return deferred.promise();
    },

    /**
    * 负责切换模块, 并初始化
    * 支持事件: modulechange, modulechangecanceled, modulechangefailed
    * 使用方法:  
    * $.hijax.changeModule({name: 'user', method: 'getUserinfo'}, opts); 通过API映射表对应接口载入
    * $.hijax.changeModule('http://www.paidui.com/services/getuserinfo.html', opts); 通过url地址载入
    * $.hijax.changeModule($.hijax.modules.user, opts); 载入已存在模块
    * $.hijax.changeModule($('#user[widget="module"]'), opts); 载入已存在模块
    * $.hijax.changeModule($('<div widget="module" />'), opts); 脚本动态创建模块
    */
    changeModule = function (toModule, options) {
		if (this instanceof $) {
			options.isSubModule = true;
		}
        // 建议曝露带*号选项
        options = $.extend({
            bubble: true, // 默认冒泡 *
            moduleContainer: undefined // 容器 *, 
        }, options);
        options.moduleContainer = options.moduleContainer || $.hijax.moduleContainer;
        options.push = (options.push === undefined) ? true : options.push;

        var mc = options.moduleContainer, vevt, bubble = options.bubble,
            trigdata = { toModule: toModule, options: options },
            fromModule,
            template, dataUrl, title, url,
        // 解决闭包函数引起的循环引用
            _done = null, _fail = null;

        // 切换中
        if (isModuleChanging) {
            // 快速触发changeModule, 默认采用最近的一次操作
            vevt = $.Event('modulechangecanceled');
            mc._trigger(vevt, trigdata, bubble);
            if (vevt.isDefaultPrevented()) {
                // 添加至队列
                echo('添加至队列');
                moduleChangeQueue.unshift(arguments);
                return;
            }
            
            // 溢出
            _abort();
			if (deferred) deferred.reject();
            isModuleChanging = false;
            _blurActiveLink();
        }
        
        // 将指针置为切换状态
        isModuleChanging = true;
        // API映射表或url地址
        if ($.isPlainObject(toModule) || typeof toModule === 'string') {
            // 模块载入失败
            _fail = function () {
                _blurActiveLink();
                _unfreeze();
                // 触发modulechangefailed事件; 可设计切换失败机制
                mc._trigger('modulechangefailed', trigdata, bubble);
            };

            // 使用一个长操作对象
            _done = function (toModule, options) {
                isModuleChanging = false;
                changeModule(toModule, options);
            };
            options.changeModule = true;
            deferred = loadModule(toModule, options)
                .done(function (toModule, options) {
                    _done(toModule, options);
                    _done = null;
                })
                .fail(function () {
                    _fail();
                    _fail = null;
                });
            return;
        }

        // 组件对象
        if (toModule instanceof $.hijax.module) {
            toModule = toModule.element;
        }

        dataUrl = toModule.attr('url')
                || toModule.attr('uid')
        // 兼容IE浏览器
                || toModule[0].name
                || toModule.attr('name');

        // 绝对地址
        url = path.getAbsoluteUrl(path.resolve(dataUrl), baseUrl);

        // 模块标题
        title = toModule.attr("title") || document.title;

        // 未初始化
        if (!toModule.data('hijax-module')) {
            // 模板
            template = toModule.outerHtml();

            // 模块唯一标识
            toModule.attr('url', dataUrl);

            // 初始化模块
            toModule.module({ template: template });
        }

        fromModule = $.hijax.activeModule;

        // 同一模块
        if (fromModule && fromModule[0] === toModule[0]) {
            _blurActiveLink();
            _unfreeze();
            mc._trigger("modulechange", trigdata, bubble);
            return;
        }

        echo('It will trigger hashchange');
        // 后退或前进或刷新不操作历史记录
        if ($.hijax.historyEnabled && options.push) {
            $.hijax.setHash(dataUrl);
            // 不触发hashchange事件
            $win._overrideListener('hashchange', true, null, true);
            try {
                $title.html(_encodeTitle(title));
            } catch (error) {
                // do nothing
            }
        }

        _done = function ($to, $from) {
            _blurActiveLink();
            // var $body = $('body');
            // if ($body.ScrollTo || false) { 
            //    $body.ScrollTo(scrollOptions);
            // }

            // 第一次访问页面, 尚无模块载入
            !$from && ($.hijax.rootUrl = url);
            // 使toModule获得焦点
            $.hijax.activeModule = $to;
            _unfreeze();
            mc._trigger("modulechange", trigdata, bubble);
        };
        _transitionModules(toModule, fromModule)
            .done(function ($to, $from) {
                _done($to, $from);
                _done = null;
            });
    },

    /**
    * 负责载入模块, 并初始化
    * 支持事件: moduleload, moduleloadfailed
    * url类型: a. 链接地址 b. 接口对象
    */
    loadModule = function (url, options) {
        options = $.extend({
            type: "GET", // 模板数据载入方式
            data: undefined, // 要传递的数据
            dataApi: null,
            // data: undefined, // 要传递给dataApi的数据
            params: undefined, // 传参
            bubble: true, // 默认冒泡
            showLoadMsg: true, // 载入模块时是否显示提示信息
            showMask: false, // 载入模块时是否显示遮罩层
            moduleContainer: undefined, // 容器
            loadMsgDelay: $.hijax.loadMsgDelay, // 模块载入时间低于此值, 将不显示加载信息
            reload: false // 是否刷新当前模块
        }, options);
        options.moduleContainer = options.moduleContainer || this || $.hijax.moduleContainer;

        var 
        // 主模块: Member
        // 因项目而异, 某些项目可能并不采用主次模块的架构
		nodeInfo, 
        // mNode,
        // 次模块: MemberAdd
        // node,
        // 参数
        queries,
        u = path.resolve(url),
        deferred = $.Deferred(),
        $module = null, 
        moduleCache = {}, 
        template = '',
        title = '',
        pmt = false, 
        isApi = $.isPlainObject(url),
        dataUrl,
        props = {}, args = {},
        loadMsgDelay = 0,
        _hideLoadMsg = function () { },
        _getViewUrl, 
        _getControllerUrl, 
        mc = options.moduleContainer,
        vevt = {},
        bubble = options.bubble,
        trigdata = {},
        ajaxSettings, 
        requestInstances, 
        _modulize = function() {
            args = { title: title, template: template, moduleContainer: options.moduleContainer, changeModule: options.changeModule, isSubModule: options.isSubModule };
            if (options.isSubModule) {
				args.commData = $.util.unparam(nodeInfo.queries);
			}
			if (options.isParentModule) {
				args.commData = $.hijax.activeModule.data('hijax-module').commData;
			}
			// 初始化模块
            $module.module(!$.isEmptyObject(props) ?
                $.extend(props, $.extend(args, { prior: true })) :
                args);
            requestInstances = $module.data('hijax-module')._requestInstances;
            cnet = cnet.concat(requestInstances);
			// 第352行代码调至338行, 以便模块初始化阶段所有相关请求能够被溢出
			// 缺点: 模块初始化完毕方才显示
			deferred.resolve($module, options);
        },  
        // fromCache: from $.hijax.cache
        _loadModule = function(fromCache) {
            /*    
            ~u.path.search(/\/([^\/]+?)\/([^(.|\/)]+?)(\.\w+?)?(\?|$)/i);
            mNode = RegExp.$1;
            node = RegExp.$2;
            */
            $module = $('<div />', {
                uid: nodeInfo.node, 
                title: title,
                url: dataUrl
            }).on('moduleinit', function() {
                // deferred.resolve($module, options);
                if (options.showLoadMsg) {
                    _hideLoadMsg();
                }                   
            });
            
            /** 目前尚无外域请求, 为提高性能, 暂时注释
            // 针对合法外域, 在插入文档之前, 将所有相对地址替换为绝对地址
            pmt = path.isPermittedCrossDomainRequest(u);
            if (pmt) {
                // 现代浏览器支持原生否定伪类
                $('a:not([href^="http"]), img:not([href^="http"]), script:not([href^="http"]), iframe:not([href^="http"]), form:not([href^="http"])')
                    .each(function () {
                        var attr = this.href ? 'href' : (this.src ? 'src' : 'action');
                        $(this).attr(attr, path.getAbsoluteUrl(path.resolve(this[attr]), u));
                    });
            }
            */

            $.hijax.latestLoadedModule = $module;

            // 触发moduleload事件, 在初始化模块之前, 保证模块对应脚本载入完成
            trigdata.url = url;
            // trigdata.node = node;
            // trigdata.mNode = mNode;
            trigdata.isSameDomain = !pmt;
            mc._trigger("moduleload", trigdata, bubble);
           
            if (!fromCache) {
                // 针对外域不做处理
                if (!pmt) {
                    _getControllerUrl = $.hijax.controllersPath;
                    if ($.type($.hijax.controllersPath) === 'string') {
                        _getControllerUrl = function (data) {
                            var src = $.hijax.controllersPath + data.mNode + '/' + data.node + '.js';
							// 统一在源头添加版本号
							// if (!isIe) {
                                // src = path.addQueries(src, { v: $.util.v });
                            // }  
                            return src;
                        };
                    }
                    var controllerUrl = _getControllerUrl(nodeInfo);
                    cnet.push($.ajax({
                        global: false,
                        url: controllerUrl, 
                        async: true, 
                        dataType: 'script', 
                        success: function() {
                            if (!$.hijax.dev) {
                                var _cache = $.hijax.cache[nodeInfo.node];
                                _cache.title = title;
                                _cache.template = template;
                            }
                            _modulize();
                        }, 
                        error: function() {
                            try {
                                echo("找不到业务文件");
                            } catch (e) {}                         
                        }, 
						complete: function(xhr) {
							var idx = $.inArray(xhr, cnet);
							cnet.splice(idx, 1);
						}
                    }));
                   
                } 
            } else {
                $.hijax.createModule(moduleCache, $module);
                _modulize();
            }           
        };
        
        // 只针对非外域且相对地址; 绝对地址本身就是正确的地址
        // url: Member.MemberAdd | Member/MemberAdd
        if (!path.isExternal(u)) {
			// 返回键mNode, node, queries
			nodeInfo = $.hijax.nodeRE(url);
			
            if (path.isRelative(u)) {
                _getViewUrl = $.hijax.viewsPath;
                if ($.type($.hijax.viewsPath) === 'string') {
                    _getViewUrl = function (data) {
                        var url = $.hijax.viewsPath + data.mNode + ((data.node && ('/' + data.node)) || '');
                        data.queries && (url += data.connector + data.queries);
                        return url;
                    }
                }
                url = _getViewUrl(nodeInfo);
                u = path.resolve(url);
            }
        }

        isApi && (url = $.hijax.apiMap[url.name].url);
        // 未授权地址
        /** 目前尚无外域请求, 为提高性能, 暂时注释
        if (!path.isPermittedDomainRequest(u)) {
            try {
                throw '未授权的域请求!';
            } catch (error) {
                // do something
            }
            deferred.reject();
            return deferred.promise();
        }
        */
        
        // 生成绝对地址
        url = path.getAbsoluteUrl(u, baseUrl);
        // 外域与api地址生成url对应MD5码
        /** 目前尚无外域请求, 为提高性能, 暂时注释
        dataUrl = path.isExternal(u) ?
                $.util.MD5(url) :
                isApi && !$.hijax.historyApi ?
                    $.util.MD5(url) :
                    path.getRelativeUrl(u);
        */
        dataUrl = path.getRelativeUrl(u);

        if (dataUrl === $.hijax.homePage) {
            url = $.hijax.rootUrl;
            u = path.resolve(url);
            dataUrl = path.getRelativeUrl(u);
        }
        
        // 向后兼容, 建议使用dataApi替代
		/*
        if (options.data || options.type.toLowerCase() !== 'get') {
            props.dataApi = { data: options.data, type: options.type };
        }
		*/
        if (options.type.toLowerCase() !== 'get') {
            props.dataApi = { type: options.type };
        }		
        if (options.dataApi) {
            props.dataApi = $.extend(true, props.dataApi || {}, options.dataApi);
        }

        if (options.params) {
            props.params = options.params;
        }
        if (options.tplData) {
            props.tplData = options.tplData;
        }
        
        // 触发beforemoduleload事件
        vevt = $.Event('beforemoduleload');
        mc._trigger(vevt, u, bubble);
        if (vevt.isDefaultPrevented()) {
            deferred.reject();
            return deferred;
        }
        
        $module = nodeInfo.node ? $doc.find('[uid=' + nodeInfo.node + ']') : $doc.find('[url="' + dataUrl + '"]');
        if ($module.length) {
			if (!options.reload) {
				deferred.resolve($module, options);
				return deferred;
			} else {
				// 移除旧模块
				var moduleobj = $module.data('hijax-module');
				moduleobj.options.keepState = false;
				moduleobj._trigger('hide');
				$.hijax.activeModule = null;
			}
        } 
        
        // 从远程地址请求模块
        if (options.showLoadMsg) {
            loadMsgDelay = setTimeout(function () {
                options.moduleContainer.showLoadMsg({ mask: options.showMask, center: true, type: 'info', defaultMsg: $.hijax.loadMsg });
            }, options.loadMsgDelay);
            
            _hideLoadMsg = function () {
                clearTimeout(loadMsgDelay);
                options.moduleContainer.hideLoadMsg();
            };
        } 
        
        moduleCache = $.hijax.cache[nodeInfo.node];
        if (moduleCache) {
			if (!options.reload) {
				template = moduleCache.template;
				title = moduleCache.title;
				_loadModule(true);
				return deferred;
			} else {
				delete $.hijax.cache[nodeInfo.node];
			}
        }
        
        ajaxSettings = {
			data: options.data, 
			dataType: 'html', 
            success: function (html, textStatus, xhr) {
                if (!$.contains(document, mc[0])) return;
                /*
                html = html
                .replace(/<\!DOCTYPE[^>]*>/i, '')
                .replace(/<(html|head|body|title|meta)([\s\>])/gi, '<div class="document-$1"$2')
                .replace(/<\/(html|head|body|title|meta)\>/gi, '</div>');
                var content = $html.find('.document-body:first').html() || $html.html(), 
                title = $html.find('.document-title:first').text();
                */
                // 确保正确解析模板: $('{#foreach...') -> []
                template = html;
                title = html.match(/<title[^>]*>([^<]*)/) && RegExp.$1;
                _loadModule();
            },
            error: function (xhr, textStatus, error) {
                trigdata.xhr = xhr;
                trigdata.textStatus = textStatus;
                trigdata.error = error;
                vevt = $.Event("moduleloadfailed");
                // 触发moduleloadfailed事件; 可设计载入失败机制, 比如, 重载
                mc._trigger(vevt, trigdata, bubble);
                // 可在loadfailed阶段冻结界面
                if (vevt.isDefaultPrevented()) {
                    return;
                }

                if (options.showLoadMsg) {
                    _hideLoadMsg();
                    if (textStatus !== 'abort') {
                        options.moduleContainer.showLoadMsg({ message: $.hijax.loadErrorMsg, type: 'error', mask: options.showMask, center: true });
                        setTimeout($.fn.hideLoadMsg, 1500);
                    }
                }

                deferred.reject(url, options);
            }, 
			complete: function(xhr) {
				var idx = $.inArray(xhr, cnet);
				cnet.splice(idx, 1);
			}
        };
        isApi ? (ajaxSettings.api = url) : (ajaxSettings.url = url);

        cnet.push($.ajax(ajaxSettings));
        return deferred;
    };

    // API
    $.extend($.hijax, {
        changeModule: changeModule
    });

    $.extend($.fn, {
        loadModule: loadModule, 
        changeModule: changeModule
    });

})(jQuery);