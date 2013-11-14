(function ($) {
    $.hijax.template.adapter('dot', (function () {
        return {
            output: '',
            valid: function () {
                return $.type(doT) == 'object';
            },
            init: function (tpl, data, options) {
                var fn = doT.template(tpl, options);
                this.output = fn(data);
            }
        };
    })());
})(jQuery);
