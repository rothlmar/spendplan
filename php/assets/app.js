'use strict';

var update_exch_rates = function(date,exch_store) {
    var max_date = date;
    var uncovered_dates = [];
    var yesterday = new Date(new Date()-86400000);
    yesterday.setHours(0,0,0,0);
    // console.log('yesterday', JSON.stringify(yesterday));
    while (max_date.getTime() < yesterday.getTime()) {
	var temp_date = new Date(max_date.valueOf() + 86400000);
	uncovered_dates.push(temp_date);
	max_date = temp_date;
    };
    // console.log(JSON.stringify(uncovered_dates));


    $.each(uncovered_dates,function(index,value) {
	var req_str = "http://openexchangerates.org/api/historical/" + value.toJSON().substring(0,10) + ".json?app_id=36646cf83ce04bc1af40246f9015db65"
	$.get(req_str,function(data) {
    	    var day_of_rate = new Date(data.timestamp*1000-1000);
    	    day_of_rate.setHours(0,0,0,0);
    	    var day_rate = data.rates.GBP;
    	    console.log("ADDING DAY:", day_rate, JSON.stringify(day_of_rate));
    	    exch_store.insert({
    		date: day_of_rate,
    		rate: day_rate
    	    });
	});
    })
};

var app = angular.module('spendPlan',['dropstore-ng']);

app.filter('empty', function () {
    return function(input) {
	if (input != '') {
	    return input;
	} else {
	    return "Uncategorized";
	}
    };
});

app.filter('winnow', function() {
    return function(input, winnowFn) {
	console.log("WINNOWING AWAY");
	var ret_arr = new Array;
	for (var i in input) {
	    if (winnowFn(input[i])) {
		ret_arr.push(input[i]);
	    }
	};
	return ret_arr;
    }
});

app.controller(
    'SpendPlanCtrl', 
    function SpendPlanCtrl($scope, $timeout, $http, 
			   dropstoreClient, winnowFilter, orderByFilter) {
	var extractData = function(transaction) {
	    var exp_trans = {
		trans: transaction,
		amount: transaction.get('Amount'),
		date: transaction.get('Date'),
		note: transaction.get('Note'),
		category: transaction.get('Category'),
		acct: $scope.acctTable.get(transaction.get('Account')).get('acctname'),
		currency: $scope.acctTable.get(transaction.get('Account')).get('currency'),
		tags: $scope.getTags(transaction)
	    };
	    exp_trans.currency_symbol = $scope.currSymbol(exp_trans.currency);
	    if (exp_trans.amount >= 0) {
		exp_trans.color = 'success'
	    } else {
		exp_trans.color = 'danger'};
	    return exp_trans;
	};
	
	var _datastore = null;
	var _accountTable = null;
	var _transactionTable = null;
	var _exchangeTable = null;
	var latest_date = new Date(0);

	$scope.newAcct = {name:'', curr:'USD'};
	$scope.accounts = [];
	$scope.transactions = {};
	
	var catFilter = function(transaction) {
	    var cat_pat = new RegExp($scope.loc_trans_filter.category,'gi');
	    var note_pat = new RegExp($scope.loc_trans_filter.note,'gi');
	    var acct_pat = new RegExp($scope.loc_trans_filter.account,'gi');
	    var min_test = true;
	    var max_test = true;
	    if ($scope.loc_trans_filter.amount_min != '') {
		min_test = (transaction.amount >= Number($scope.loc_trans_filter.amount_min));
	    };
	    if ($scope.loc_trans_filter.amount_max != '') {
		max_test = (transaction.amount <= Number($scope.loc_trans_filter.amount_max));
	    };
	    
	    var date_min = true;
	    var date_max = true;
	    if ($scope.loc_trans_filter.date_min != '') {
		date_min = (transaction.date >= new Date($scope.loc_trans_filter.date_min));
	    };
	    if ($scope.loc_trans_filter.date_max != '') {
		date_max = (transaction.date <= new Date($scope.loc_trans_filter.date_max));
	    };
	    var account_match = true;
	    
	    return cat_pat.test(transaction.category) & 
		note_pat.test(transaction.note) &
		acct_pat.test(transaction.acct) &
		min_test & max_test &
		date_min & date_max;
	};
	
	$scope.filteredTransactions = [];
	$scope.$watchCollection('loc_trans_filter', function() { 
	    $scope.filteredTransactions = orderByFilter(winnowFilter($scope.transactions,
		   						     catFilter),
		   					'date',true);
	});
	$scope.$watchCollection('transactions', function() { 
	    $scope.filteredTransactions = orderByFilter(winnowFilter($scope.transactions,
		   						     catFilter),
		   					'date',true);
	});
	
	$scope.categories = {};
	$scope.plan_categories = {};
	$scope.catDate = {
	    start: '',
	    end: ''
	};
	$scope.edit_category = {
	    tran: null,
	    repl: ""
	};
	$scope.edit_note = {
	    tran: null,
	    repl: ""
	};
	$scope.edit_tags = {
	    tran: null,
	    repl: ""
	};
	$scope.trans_filter = {
	    date_min:'',
	    date_max:'',
	    amount_min:'',
	    amount_max:'',
	    category:'',
	    note:'',
	    account:''
	};
	$scope.loc_trans_filter = {
	    date_min:'',
	    date_max:'',
	    amount_min:'',
	    amount_max:'',
	    category:'',
	    note:'',
	    account:''
	};
	$scope.newTrans = {
	    date: '',
	    amount: '',
	    category: '',
	    note: '',
	    account: ''
	};


	var dropox_owner_name = '';
	$scope.exchangeRates = {};
	dropstoreClient.create({key: "i86ppgkz7etf1vk"})
	    .authenticate({interactive: true})
	    .then(function(datastoreManager) {
		console.log('completed authentication');
		// dropstoreClient.getAccountInfo({}, function(error, acctinfo, acct_json) {
		//     dropbox_owner_name = acctinfo.name;
		//     console.log(dropbox_owner_name);
		// });
		return datastoreManager.openDefaultDatastore();
	    })
	    .then(function(datastore) {
		var extractAcct = function(account) {
		    var exp_acct = {
			acct: account,
			name: account.get('acctname'),
			currency: account.get('currency'),
			currency_symbol: $scope.currSymbol(account.get('currency')),
			balance: $scope.getBalance(account)
		    };
		    return exp_acct;
		};
		
		_datastore = datastore;
		
		_transactionTable = _datastore.getTable('transactions');
		_accountTable = _datastore.getTable('accounts');

		$scope.acctTable = _accountTable;
		var temp_accounts = _accountTable.query();
		for (var ndx in temp_accounts) {
		    $scope.accounts.push(extractAcct(temp_accounts[ndx]));
		};
		$scope.newTrans.account = $scope.accounts[0];
		
		_datastore.SubscribeRecordsChanged(function(records) {
		    for (var ndx in records ){
			$scope.accounts.push(extractAcct(records[ndx]));
		    }
		}, 'accounts');
		
		
		_exchangeTable = _datastore.getTable('exchange_rates')
		var temp_rates = _exchangeTable.query();
		for (var ndx in temp_rates) {
		    var rate_date = temp_rates[ndx].get('date');
		    rate_date.setHours(0,0,0,0);
		    if (rate_date > latest_date) {
			latest_date = rate_date;
		    };
		    $scope.exchangeRates[rate_date] = temp_rates[ndx].get('rate');
		};
		_datastore.SubscribeRecordsChanged(function(records) {
		    for (var ndx in records ){
			var rate_date = records[ndx].get('date');
			rate_date.setHours(0,0,0,0);
			if (rate_date > latest_date) {
			    latest_date = rate_date;
			};
			$scope.exchangeRates[rate_date] = records[ndx].get('rate');
		    }
		}, 'exchange_rates');
		
		// console.log(JSON.stringify(latest_date));
		// first time: grab exchange rates previously stored
		$http({method: 'GET', url: '/rates.json'}).
		    success(function(data, status, headers, config) {
			var last_date = latest_date;
			angular.forEach(data, function(value,ndx) { 
			    var val_date = new Date(value['date'])
			    if (val_date.getTime() > last_date.getTime()) {
    				_exchangeTable.insert({
    				    date: val_date,
    				    rate: value['rate']
    				});
				if (val_date.getTime() > latest_date.getTime()) {
				    latest_date = val_date;
				};
			    } else {
				// console.log(JSON.stringify(val_date),
				// 	       JSON.stringify(last_date),
				// 	       JSON.stringify(latest_date))
			    };
			});
			update_exch_rates(latest_date,_exchangeTable);
		    });
		
		var trans_temp = _transactionTable.query();
		var categories = {};
		for (var ndx in trans_temp) {
		    var record = trans_temp[ndx];
		    $scope.transactions[record.getId()] = extractData(record);
		    var cat_name = record.get('Category');
		    if (!(cat_name in categories)) {
			categories[cat_name] = 0;
		    };
		};
		for (var key in categories) {
		    categories[key] = $scope.getCatBalance(key);
     		};
		$scope.categories = categories;
		
		_datastore.SubscribeRecordsChanged(function(records) {
		    for (var ndx in records) {
			var record = records[ndx];
			var prev_cat = null;
			var cur_cat = null;
			if ($scope.transactions[record.getId()]) {
			    prev_cat = $scope.transactions[record.getId()].category;
			};
			if (record.isDeleted()) {
			    delete $scope.transactions[record.getId()];
			} else {
			    $scope.transactions[record.getId()] = extractData(record);
			    cur_cat = record.get('Category');
			};
			if (prev_cat) {
			    $scope.categories[prev_cat] = $scope.getCatBalance(prev_cat);
			}
			if (cur_cat) {
			    $scope.categories[cur_cat] = $scope.getCatBalance(cur_cat);
			}
		    };
		    for (var ndx in $scope.accounts) {
			var acct = $scope.accounts[ndx];
			acct.balance = $scope.getBalance(acct.acct);
		    }
		}, 'transactions');
	    });
	
	$scope.getBalance = function(account) {
	    var acct_trans = _transactionTable.query({"Account": account.getId()});
	    var total = 0.0;
	    for ( var ndx in acct_trans) {
		total += acct_trans[ndx].get('Amount');
	    }
	    return total;
	};
	
	$scope.getCatBalance = function(category) {
	    var start_date = new Date(0);
	    var end_date = new Date();
	    if ($scope.catDate.start != '') {
		start_date = new Date($scope.catDate.start);
	    };
	    if ($scope.catDate.end != '') {
		end_date = new Date($scope.catDate.end);
	    };
	    // console.log(start_date,end_date);
	    var cat_trans = _transactionTable.query({"Category": category});
	    var total = 0.0;
	    for ( var ndx in cat_trans) {
		var trans = cat_trans[ndx];
		var add_to_total = ((trans.get('Date') >= start_date) && 
				    (trans.get('Date') <= end_date));
		var amount = trans.get('Amount');
		if ($scope.acctTable.get(trans.get('Account')).get('currency') == 'GBP') {
		    amount /= $scope.exchangeRates[trans.get('Date')];
		};
		if (add_to_total) {
		    total += amount;
		};
		
	    }
	    return total;
	}
	
	$scope.currSymbol = function(trigraph) {
	    if (trigraph == 'USD') {
		return '$';
	    } else if (trigraph == 'GBP') {
		return '£';
	    } else {
		return "ERR";
	    }
	};
	
	var filterTimeout;
	$scope.$watchCollection('trans_filter', function(newvals, oldvals) {
	    if (filterTimeout) {
		$timeout.cancel(filterTimeout);
	    };
	    
	    var new_trans_filter = {date_min:newvals.date_min,
		       		    date_max:newvals.date_max,
		       		    amount_min:newvals.amount_min,
		       		    amount_max:newvals.amount_max,
		       		    category:newvals.category,
		       		    note:newvals.note,
		       		    account:newvals.account
		       		   };
	    
	    filterTimeout = $timeout(function() {
		$scope.loc_trans_filter = new_trans_filter;
	    },1000);
	});
	
	
	$scope.addAccount = function() {
	    _accountTable.insert({
		acctname: $scope.newAcct.name,
		currency: $scope.newAcct.curr
	    });
	};
	
	$scope.addTransaction = function() {
	    var date = new Date($scope.newTrans.date);
	    _transactionTable.insert({
		Date: date,
		Amount: Number($scope.newTrans.amount),
		Category: $scope.newTrans.category,
		Note: $scope.newTrans.note,
		Account: $scope.newTrans.account.acct.getId()
	    });
	};
	
	$scope.startEdit = function(transaction,scope_elt) {
	    if (scope_elt == 'edit_tags' ) {
		$scope[scope_elt].repl = transaction.tags;
	    } else if (scope_elt == 'edit_note') {
		$scope[scope_elt].repl = transaction.note;
	    } else if (scope_elt == 'edit_category') {
		$scope[scope_elt].repl = transaction.category;
	    };
	    $scope[scope_elt].tran = transaction;
	};
	
	$scope.editCategory = function(transaction) {
	    if ($scope.edit_category.repl != '') {
		transaction.trans.set('Category', $scope.edit_category.repl);
	    };
	    $scope.edit_category.tran = null;
	    $scope.edit_category.repl = "";
	};
	
	$scope.editNote = function(transaction) {
	    if ($scope.edit_note.repl != '') {
		transaction.trans.set('Note', $scope.edit_note.repl);
	    };
	    $scope.edit_note.tran = null;
	    $scope.edit_note.repl = "";
	};
	
	$scope.editTags = function(transaction) {
	    var trans_tags = transaction.trans.getOrCreateList('Tags');
	    var tag_arr = trans_tags.toArray();
	    var cur_num_tags = trans_tags.length();
	    for (var ndx = 0; ndx < cur_num_tags; ndx++ ) {
		trans_tags.pop();
		// console.log(trans_tags);
	    };
	    if ($scope.edit_tags.repl.trim() != '')
	    {
		var all_tags = $scope.edit_tags.repl.split(',');
		for (var ndx in all_tags) {
		    var cur_tag = all_tags[ndx].trim();
		    trans_tags.push(cur_tag);
		};
	    };
	    $scope.edit_tags.tran = null;
	    $scope.edit_tags.tags = "";
	};
	
	
	$scope.getTags = function(transaction) {
	    var tag_list = transaction.getOrCreateList('Tags');
	    var ret_list = tag_list.toArray();
	    if (tag_list.length() == 0) {
		ret_list.push('None');
	    };
	    return ret_list;
	};
	
	$scope.thisIsIt = function(transaction,scope_elt) {
	    return transaction == $scope[scope_elt].tran;
	};
	
    });
