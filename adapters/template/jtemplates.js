(function ($) {
    $.hijax.template.adapter('jtemplates', (function () {
        return {
            output: '',
            valid: function () {
                return !!$.createTemplate;
            },
            init: function (tpl, data, options) {
                tpl = $.createTemplate(tpl);
                this.output = $.processTemplateToText(tpl, data);
            }
        };
    })());
})(jQuery);