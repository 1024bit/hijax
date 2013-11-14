(function($) {
	// 只有宿主对象是跨沙箱的, document.write生成了一个新的沙箱
	var U = window.U;
    if (U === undefined) {
        U = {v: '', dev: '', baseUrl: '', rServ: ''};
    } 
    
    /**
     * 错误映射表
     */
	var errors = {
		'E000': '', //未知的错误code
		'E101': '跨域访问出错！',
		'E102': '服务器返回错误！',
		'E103': '请求已取消！',
		'E104': '服务器输出格式错误！',
		'E201': '用户不存在！'
	};
	def('ERROR_MAP', {
		framework: {
			'crossDomain':  'E101',
			'remoteError': 'E102',
			'requestAbort': 'E103',
			'resultDecodeError': 'E104'
		},
		demo: {
			'notFoundUser': 'E201'
		}
	}); 
    
    /** 
     * 跨域列表配置
     * 支持通配符*; ''为不允许跨域
     */  
    def('ACCESS_CONTROL_ALLOW_ORIGIN', []);

    /** 
     * request类配置
     */
    def({
        REQUEST_TIMEOUT: 120000, 
        REQUEST_MERGE_TIME: 0, 
        REQUEST_MERGE_KEY: 'mergekey', 
        REQUEST_JSONP_KEY: 'callback'
    });

    /** 
     * 模板引擎
     */
    def('TPL_ENGINE', {
        adapter: 'dot', 
        options: null
    });	

    /** 
     * 应用缓存
     */
    def({
        // 开启应用缓存, 默认禁用
        APP_CACHE_ENABLED: false, 
        // 应用缓存文件地址
        APP_CACHE_URL: U.baseUrl + '/cache/manifest', 
        // 应用缓存器, 优先级为: dom, userdata, memory
        APP_CACHE_ADAPTER: ''
    });

    /** 
     * 底层框架配置
     */
    var base = {
        // 总是请求业务脚本与模板文件; 开发环境下默认开启 
        // 请在产品环境禁用此项, 将使用缓存以提升性能
        DEV: U.dev || false, 
        // 用于控制台输出框架执行信息; 开发环境下默认开启, 请在产品环境禁用此项
        DEBUG: false, 
        // 域名, 不带尾斜线
        DOMAIN: U.baseUrl, 
        // 装载模块的默认容器
        MODULE_CONTAINER: $(document), 
        // 模块HTML结构接口, VIEWS_PATH支持函数
        VIEWS_PATH: U.baseUrl + '/index.php/',  
        // 模块业务逻辑接口, CONTROLLERS_PATH支持函数
        CONTROLLERS_PATH: U.rServ + '/scripts/', 
        // 组件目录, 用于按需加载组件
        // WIDGETS_PATH: '', 
        // 激活按钮CSS类
        ACTIVE_LINK_CLASS: '', 
        // 禁用按钮CSS类
        DISABLED_LINK_CLASS: '', 
        // 载入模块时的提示信息, 为空则使用loading图标代替
        LOAD_MSG: '正在载入...', 
        // 模块载入时间低于此值, 将不显示加载信息
        LOAD_MSG_DELAY: 10, 
        // 载入模块失败时的提示信息
        LOAD_ERROR_MSG: '加载失败，请检查网络配置...', 
        // 历史记录, 默认开启, 禁用后将不支持前进后退
        HISTORY_ENABLED: false, 
        // 模块的数据源地址属于API_MAP列表, 浏览器地址栏默认不显示该数据源地址; 确保对外开放API地址不存在安全隐患情况下开启, 将会提升性能
        HISTORY_API: false, 
        // 使用来自代理的缓存, 默认开启, 禁用后将从原始服务器获取资源
        PROXY: true, 
        // 线网下抑制异常, 开发阶段请关闭
        IGNORE_ERROR: false, 
        // 以tab方式显示模板, v1.1.1
        TAB_VIEW: false
    };
    def(base);
})(jQuery);