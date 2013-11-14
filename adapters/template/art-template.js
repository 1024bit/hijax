(function ($) {
    $.hijax.template.adapter('artTemplate', (function () {
        return {
            output: '',
            valid: function () {
                return $.type(template) == 'function';
            },
            init: function (tpl, data, options) {
                if (options && options.openTag && options.closeTag) {
                    template.openTag = options.openTag;
                    template.closeTag = options.closeTag;
                }

                var fn = template.compile(tpl);
                this.output = fn(data);
            }
        };
    })());
})(jQuery);