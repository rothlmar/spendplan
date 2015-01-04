'use strict';

angular.module('spHelpers',[])
    .value('transLimiter', function(transaction, filt_obj) {
    	var note_pat = new RegExp(filt_obj.note,'gi');
    	var tag_pat = new RegExp(filt_obj.tags,'gi');
	// min_test and max_test don't respect splits...should they?
    	var min_test = true;
    	var max_test = true;
    	if (filt_obj.amount_min && filt_obj.amount_min != '') {
    	    min_test = (transaction.amount >= Number(filt_obj.amount_min));
    	};
    	if (filt_obj.amount_max && filt_obj.amount_max != '') {
    	    max_test = (transaction.amount <= Number(filt_obj.amount_max));
    	};
	
    	var date_min = true;
    	var date_max = true;
    	if (filt_obj.date_min && filt_obj.date_min != '') {
    	    date_min = (transaction.date >= new Date(filt_obj.date_min));
    	};
    	if (filt_obj.date_max && filt_obj.date_max != '') {
	    var filt_max_date = new Date(filt_obj.date_max);
	    filt_max_date.setHours(23,59,59);
    	    date_max = (transaction.date <= filt_max_date);
    	};
    	var tag_match = true;
    	var tags_not_matched = 0;
    	angular.forEach(transaction.tags, function(tag) {
    	    if (!tag_pat.test(tag)) { 
    		tags_not_matched += 1;
    	    };
    	});
	
    	if (tags_not_matched == transaction.tags.length) {
    	    tag_match = false;
    	};

	var splitCats = function(t) {
	    if (filt_obj.category.indexOf(t.category) > -1) {
		return true;
	    } else {
		for (var cat in t.splits) {
		    if (filt_obj.category.indexOf(cat) > -1) {
			return true;
		    }
		}
	    }
	    return false;
	};
	
    	return (filt_obj.category.length == 0 || splitCats(transaction)) &&
    	    note_pat.test(transaction.note) &&
	    (filt_obj.account.length == 0 || filt_obj.account.indexOf(transaction.acct) > -1) &&
    	    tag_match &&
    	    min_test && max_test &&
    	    date_min && date_max;
    })
    .value('updateExchangeRates', function(date,exch_store) {
	var max_date = date;
	var uncovered_dates = [];
	var  yesterday = new Date()
	yesterday = new Date(Date.UTC(yesterday.getUTCFullYear(),
				      yesterday.getUTCMonth(),
				      yesterday.getUTCDate()));	    
	yesterday = new Date(yesterday-86400000);
	console.log('yesterday', JSON.stringify(yesterday));
	while (max_date.getTime() < yesterday.getTime()) {
	    uncovered_dates.push(max_date);
	    max_date = new Date(max_date.valueOf() + 86400000);
	};
	// console.log("UNCOVERED: ", JSON.stringify(uncovered_dates));
	
	
	$.each(uncovered_dates,function(index,value) {
    	    var req_str = "https://openexchangerates.org/api/historical/" 
		+ value.toJSON().substring(0,10) 
		+ ".json?app_id=36646cf83ce04bc1af40246f9015db65"
    	    // console.log("getting " + req_str);
    	    $.get(req_str,function(data) {
    		var day_of_rate = new Date(data.timestamp*1000);
		day_of_rate = new Date(Date.UTC(day_of_rate.getFullYear(),
						day_of_rate.getMonth(),
						day_of_rate.getDate()));	    
    		var day_rate = data.rates.GBP;
    		console.log("ADDING DAY:", day_rate, JSON.stringify(day_of_rate));
    		exch_store.insert({
    		    date: day_of_rate,
    		    rate: day_rate
    		});
    	    });
	});
    })
    .value('extractData', function(transaction, account, exch_rate) {
	var getTags = function(transaction) {
	    var tag_list = transaction.getOrCreateList('Tags');
	    var ret_list = tag_list.toArray();
	    if (tag_list.length() == 0) {
		ret_list.push('None');
	    };
	    return ret_list;
	};

	var getSplits = function(transaction) {
	    var split_list = transaction.getOrCreateList('Splits');
	    var work_list = split_list.toArray();
	    // console.log('GETTING SPLITS');
	    // console.log(work_list);
	    var splits = {};
	    for (var idx = 0; idx < work_list.length; idx++) {
		if (idx % 2) {
		    splits[work_list[idx-1]] = {amount: work_list[idx]};
		}
	    }
	    return splits;
	};

	var currSymbol = function(trigraph) {
	    if (trigraph == 'USD') {
		return '$';
	    } else if (trigraph == 'GBP') {
		return '£';
	    } else {
		return "ERR";
	    }
	};
	
	var exp_trans = {
	    trans: transaction,
	    amount: transaction.get('Amount'),
	    date: transaction.get('Date'),
	    note: transaction.get('Note'),
	    category: transaction.get('Category'),
	    acct: account.get('acctname'),
	    acct_id: account.getId(),
	    currency: account.get('currency'),
	    tags: getTags(transaction),
	    splits: getSplits(transaction)
	};
	// console.log(JSON.stringify(exp_trans.date));
	exp_trans.currency_symbol = currSymbol(exp_trans.currency);
	exp_trans.color = (exp_trans.amount >= 0)?'success':'danger';
	// if (!$scope.exchangeRates[exp_trans.date] && exp_trans.currency != 'USD') {
	//     console.log('help me! ', JSON.stringify(exp_trans.date));
	// }
	exp_trans.dollar_amount = (exp_trans.currency == 'USD')?exp_trans.amount:exp_trans.amount/exch_rate;
    	angular.forEach(exp_trans.splits, function(val, key) {
	    val.dollar_amount = (exp_trans.currency == 'USD')?val.amount:val.amount/exch_rate;
	})
	return exp_trans;
    });

