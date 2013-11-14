/*
 *  结果类: 保留返回的原生结果(source)和处理后的结果(data)
 */
$.hijax.result = function(o, status){
    this.status = 0;
    this.data = '';
    this.errors = null;
    this.source = o;
    if (o || status) {
        this.decode(o);
    }
};
$.hijax.result.prototype = {
    setErrors: function (errors, data) {
        var i, error;
        this.status = 0;
        this.errors = {};
        for (i in errors) {
            error = errors[i];
            if (error.tid !== '') {
                error.id = $.hijax.errorMap[error.tid][error.id];
            }
            this.errors[error.id] = error;
        }
    },
    decode: function (o) {
		this.status = (o && o.status) ? (+o.status) : 1;
		// 考虑{total: 500, data: Array[10]}
		this.data = (!o || (o.data === undefined || o.status === undefined)) ? o : o.data;
		this.errors = (o && o.errors) || null;
		if (o && o.errors) {
            var i;
            for(i in o.errors){
                var error = o.errors[i];
                error.id = $.hijax.errorMap[error.tid][error.id];
                this.errors[error.id] = error;
            }		
		}
    }
};