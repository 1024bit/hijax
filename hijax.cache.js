(function ($) {
    /**
    * 设计思路源自HTML5本地缓存机制, 增加了PNP机制
    * 为何不使用HTML5本地缓存? a: 兼容性, b: 局限性(满足不了自定义需求)
    * 使用方法: $.hijax.appCache
    * 缓存数据结构: {"lastModified":'',"data":{}}
    * 注意: 为了保持数据同步, 缓存更新是批量操作, 要么全部成功, 要么全部失败;
    * TODO: !!Application Cache Group!!
    */
    var lawnchair = function (options, callback) {
        options.adapter = options.adapter || $.hijax.appCacheAdapter;
        Lawnchair(options, callback);
    };

    $.hijax.appCache = (function () {
        if (!$.hijax.appCacheEnabled)
            return {};

        var appCache = {}, // 应用缓存对象
        version = '', // 版本号
        policies = {}, // 缓存策略
        status = 0, // 应用缓存对象状态码
        statusText = 'UNCACHED', // 状态描述
        bufferPool = [], // 临时缓存
        md5 = '', // url对应md5码
        accessLogs = [], // 访问记录
        fetchQueue = [], // 请求队列
        _prefetches = [], // 预加载列表
        path = $.util.path,
        cks = $.util.getCookies();

        // 初始化accessLogs
        lawnchair({
            name: 'appcache'
        }, function () {
            this.exists('accesslogs', function (exists) {
                if (exists) {
                    this.get('accesslogs', function (r) {
                        accessLogs = r.accesslogs;
                    });
                }
            });
        });

        // 初始化缓存配置
        md5 = $.util.MD5(path.addQueries(path.getAbsoluteUrl(path.resolve($.hijax.domain + $.hijax.appCacheUrl), $.hijax.baseUrl), $.extend(true, {}, cks)));
        lawnchair({
            name: 'appcache'
        }, function () {
            this.exists(md5, function (exists) {
                if (exists) {
                    this.get(md5, function (r) {
                        _prefetches = r.data.CACHE;
                        version = r.data.VERSION;
                        policies = r.data;
                    });
                }
            });
        });

        appCache.jqAppCache = $(appCache);

        // 单个Http请求
        var sendHttp = function (ajaxOpts) {
            var record,
            deferred = $.Deferred(),
            _md5 = md5,
            _success,
            _error,
            modified = true;

            // 获取地址对应数据
            lawnchair({
                name: 'appcache'
            }, function () {
                this.get(_md5, function (r) {
                    record = r;
                });
            });
            _success = ajaxOpts.success;
            _error = ajaxOpts.error;
            $.extend(ajaxOpts, {
                success: function (data, textStatus, xhr) {
                    echo('exec success');
                    if (_success)
                        _success.call(this, data, textStatus, xhr);
                    switch (xhr.status) {
                        // 已修改    
                        case 200:
                            record = {
                                key: _md5,
                                lastModified: xhr.getResponseHeader('Last-Modified'),
                                data: data
                            };
                            // 考虑到存储空间的容量, 目前只缓存appcahce中已定义资源
                            if (ajaxOpts.cacheable) {
                                bufferPool.push(record);
                                // 缓存更新完毕 -> IDLE
                                if (status === 1 || status === 5) {
                                    swapCache();
                                }
                            }
                            break;
                        // GET请求: 未修改, 304    
                        // POST请求: 未修改, 412    
                        case 304:
                        case 412:
                            modified = false;
                            break;
                    }
                    deferred.resolve(record, modified);
                },
                error: function (xhr, textStatus, error) {
                    if (_error)
                        _error.call(this, xhr, textStatus, error);
                    deferred.reject();
                }
            });
            if (record) {
                ajaxOpts.headers = ajaxOpts.headers || {};
                if (record.lastModified)
                    ajaxOpts.headers['If-Modified-Since'] = record.lastModified;
            }
            $.hijax.rpc(ajaxOpts);
            return deferred.promise();
        };

        // 资源请求
        var fetch = function (ajaxOpts, deferred) {
            deferred = deferred || $.Deferred();
            if (typeof ajaxOpts === 'string')
                ajaxOpts = {
                    url: ajaxOpts
                };

            // 缓存更新检查中 -> CHECKING
            if (status > 1 && status < 5 && !ajaxOpts.preloaded) {
                echo('请求:' + ajaxOpts.url + '将在预加载完毕后执行!');
                fetchQueue.push(function () {
                    fetch(ajaxOpts, deferred);
                });
                return deferred.promise();
            }

            var visited,
            policy, // 目前支持三种策略: CACHE, PNP, NETWORK
            url = ajaxOpts.url,
            inmanifest = false,
            u,
            abs = url;

            // 将相对地址转化为绝对地址
            u = path.resolve(abs);
            abs = path.getAbsoluteUrl(u, $.hijax.baseUrl);
            ajaxOpts.url = abs;

            // 同一地址, 不同的请求体, cookie返回的值可能不同
            md5 = $.util.MD5(path.addQueries(abs, $.extend(true, {}, ajaxOpts.data || {}, $.util.getCookies())));
            // 资源访问与否
            visited = ~$.inArray(md5, accessLogs);
            // appcache是否已定义该资源
            $.each(policies, function (key) {
                if ($.isArray(this)) {
                    $.each(this, function (idx, val) {
                        if (abs === path.getAbsoluteUrl(path.resolve(val), $.hijax.baseUrl)) {
                            policy = key;
                            inmanifest = true;
                            return false;
                        }
                    });
                    if (inmanifest)
                        return false;
                }
            });
            if (visited) {
                echo('已访问的地址: ' + abs);
                echo('缓存已定义:' + inmanifest);
                // appcache已定义该资源(appcache指Cache.Manifest文件)
                if (inmanifest) {
                    // 非强制加载资源
                    if (policy != 'NETWORK') {
                        // 读取缓存
                        lawnchair({
                            name: 'appcache'
                        }, function () {
                            this.get(md5, function (r) {
                                // 返回资源
                                if (ajaxOpts.success) {
                                    var opts = $.extend(true, {}, $.ajaxSettings, ajaxOpts),
                                        context = opts.context ? opts.context : opts;
                                    ajaxOpts.success.call(context, r.data);
                                }
                                deferred.resolve(r);
                            });
                        });
                        return deferred.promise();
                    }
                }
            }

            // 只缓存appcahce中已定义资源
            ajaxOpts.cacheable = inmanifest;
            // 长操作, 请求资源
            sendHttp(ajaxOpts)
                .done(function (r, modified) {
                    if (!visited) {
                        accessLogs.push(r.key);
                        lawnchair({
                            name: 'appcache'
                        }, function () {
                            this.save({
                                key: 'accesslogs',
                                accesslogs: accessLogs
                            });
                        });
                    }
                    deferred.resolve(r, modified);
                    return deferred.promise();
                })
                .fail(function () {
                    bufferPool = [];
                    deferred.reject();
                    return deferred.promise();
                });
            // 使abort方法支持deferred对象
            deferred.url = abs;
            return deferred;
        };

        // 检查更新
        var update = function () {
            var deferred, _abort = false,
            loaded = 0,
            total = 0;

            // 长操作, 请求appcache; 同步锁
            deferred = fetch($.hijax.domain + $.hijax.appCacheUrl)
                .done(function (r, modified) {
                    _prefetches = r.data.CACHE;
                    version = r.data.VERSION;
                    policies = r.data;
                    if (modified) {
                        echo('缓存文件已修改, 清空上次访问记录!');
                        // 清空访问记录
                        if (accessLogs.length) {
                            accessLogs = [r.key];
                            lawnchair({
                                name: 'appcache'
                            }, function () {
                                this.save({
                                    key: 'accesslogs',
                                    accesslogs: accessLogs
                                });
                            });
                        }

                        // 更新$.hijax.appCacheUrl对应资源
                        lawnchair({
                            name: 'appcache'
                        }, function () {
                            this.save(r, function (r) { });
                        });

                    } else {
                        appCache.jqAppCache.trigger('noupdate');
                    }

                    // 触发downloading事件
                    appCache.jqAppCache.trigger('downloading');

                    // 遍历预加载资源列表
                    total = _prefetches.length;
                    $.each(_prefetches, function () {
                        // 长操作
                        // this为引用
                        fetch({
                            url: String(this),
                            preloaded: true
                        })
                        .done(function (r) {
                            loaded++;
                            // 触发进度事件, 可绑定到进度条控件
                            appCache.jqAppCache.trigger('progress', {
                                loaded: loaded,
                                total: total
                            });
                            // 触发updateready事件
                            if (loaded == total) {
                                appCache.jqAppCache.trigger('updateready');
                                swapCache();
                            }
                        })
                        .fail(function () {
                            _abort = true;
                            appCache.jqAppCache.trigger('error');
                            appCache.jqAppCache.trigger('obsolete');
                            // deferred.reject();
                            // return deferred.promise();
                        });
                        // 防止由error触发的溢出异常时的
                        return !_abort;
                    });
                })
                .fail(function () {
                    appCache.jqAppCache.trigger('obsolete');
                });

            appCache.jqAppCache.trigger('checking');
        };

        // 更新缓存
        var swapCache = function () {
            if (bufferPool.length) {
                lawnchair({
                    name: 'appcache'
                }, function () {
                    this.batch(bufferPool);
                });
                bufferPool = [];
            }
            appCache.jqAppCache.trigger('cached');
            _unfreeze();
        };

        // 执行外部延迟的资源请求
        var _unfreeze = function () {
            $.each(fetchQueue, function (idx) {
                fetchQueue.splice(idx, 1);
                this();
            });

        };

        // 溢出缓存更新
        var abort = function (url) {
            // 支持fetch方法返回的deferred对象
            if ($.type(url) !== 'string') {
                url = url.url;
            }
            var req;
            if (status === 5) {
                // 溢出所有预加载请求
                $.each(_prefetches, function () {
                    req = $.hijax.requestInstances[String(this)];
                    req && req.abort();
                });
                _unfreeze();
            } else {
                // 单一资源获取, 溢出
                $.hijax.requestInstances[url].abort();
            }
        };

        /**
        * 事件:
        * onchecking, ondownloading, onupdateready, onobsolete, oncached
        * onerror, onnoupdate, onprogress
        * 状态
        * 0: UNCACHED 1: IDLE 2: CHECKING 3: DOWNLOADING 4: UPDATEREADY 5: OBSOLETE
        */
        appCache.jqAppCache.on({
            checking: function () {
                status = 2;
                statusText = 'CHECKING';
                try {
                    echo('Checking for application update');
                } catch (error) { }
            },
            downloading: function () {
                status = 3;
                statusText = 'DOWNLOADING';
                try {
                    echo('Downloading application update');
                } catch (error) { }
            },
            updateready: function () {
                status = 4;
                statusText = 'UPDATEREADY';
                try {
                    echo('Application update ready');
                } catch (error) { }
            },
            cached: function () {
                status = 1;
                statusText = 'IDLE';
                try {
                    echo('Application cached');
                } catch (error) { }
            },
            // 请求manifest文件时返回404或410
            obsolete: function () {
                status = 5;
                statusText = 'OBSOLETE';
                try {
                    echo('Application obsolete');
                } catch (error) { }
                // 应用缓存更新失败
                abort();
            },
            noupdate: function () {
                try {
                    echo('No application update found');
                } catch (error) { }
            },
            progress: function (event, data) {
                try {
                    echo('Application cache progress: ' + (data.loaded * 100 / data.total) + '%');
                } catch (error) { }
            },
            /**
            * a) manifest文件在下载过程中源文件被修改
            * b) manifest中单一资源下载出现致命错误
            * c) 引用manifest的源文档下载失败
            * d) 请求manifest文件时返回404或410
            */
            error: function () {
                try {
                    echo('Application cache error');
                } catch (error) { }
            }
        });

        // API
        appCache.version = version;
        appCache.accessLogs = accessLogs;
        appCache.sendHttp = sendHttp;
        appCache.fetch = fetch;
        appCache.update = update;
        appCache.swapCache = swapCache;
        appCache.abort = abort;
        appCache.status = status;
        appCache.statusText = statusText;

        // 初始化
        appCache.update();

        // 单例模式
        return appCache;
    })();
})(jQuery);