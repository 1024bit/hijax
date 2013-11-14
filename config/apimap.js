/* 
 *  API映射表
 *  标准api: api_url/api_name/api_method: sina.user.getUserInfo
 */  
def('API_MAP', {
	/*
	'sina': {
	    url: '',
		user: {
			'default': {mergeKey: ''}, 
			getUserInfo: {
				mergeKey: 'user', 
				data: function(data) {return data;}, 
				success: function(result) {}, 
				error: function(result) {}
			}, 
			getProductInfo: {mergeKey: 'product'}
		}

	},
	*/	
	// 勿删, 可针对API列表之外的所有请求做配置
	'default': {url: '', 'default': {'default': {}}}
});





