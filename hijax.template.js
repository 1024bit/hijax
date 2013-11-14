(function($) {
    /**
     * 模板解析引擎接口
     * 用法: $('xxx').template(tpl, data, options)
     */
    function template(tpl, data, tplEngine) {
        if (!(this instanceof template)) return new template(tpl, data, tplEngine);

        var adapter;
        tplEngine = tplEngine || $.hijax.tplEngine;
        if (tplEngine.adapter) {
            $.each(template.adapters, function(){
                if (this.adapter === tplEngine.adapter) {
                    adapter = this.valid() ? this : undefined;
                    return false;
                }
            });
        } else {
            // 默认使用
            $.each(template.adapters, function() {
                adapter = this.valid() ? this : undefined;
                if (adapter) return false;                 
            });       
        }
        if (!adapter) throw '无法识别模板';
        
        $.extend(this, adapter);

        // 初始化适配器
        this.init(tpl, data, tplEngine.options);
    }

    template.adapters = [];
    template.adapter = function(id, obj) {
        obj['adapter'] = id;
        // 实现接口
        var implementing = 'adapter output valid init'.split(' ');
        $.each(obj, function(key) {
            if (!~$.inArray(key, implementing)) {
                throw 'Invalid adapter! Nonstandard method: ' + key;
            }
        });
        
        template.adapters.unshift(obj);
    };
    
    $.fn.template = function(tpl, data, tplEngine) {
        var 
        // newer, attrs = [], self = this, 
        tplobj = $.isPlainObject(tpl) ? 
            template(this.html(), tpl, data) : 
            template(tpl, data, tplEngine);

        /* 
        newer = $(tplobj.output);
        
        attrs = $.grep(newer[0].attributes, function(attr) {
            // 兼容IE8以下浏览器
            if (attr.specified) 
                return true;
        })
        
        if (attrs.length) {
            $.each(attrs, function() {
                self.attr(this.nodeName, this.nodeValue);
            });
        }
        
        this.html(newer.html());
        */
        this.html(tplobj.output);
    };
    
    $.hijax.template = template;
})(jQuery);