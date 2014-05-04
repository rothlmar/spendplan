'use strict';

var update_exch_rates = function(date,exch_store) {
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
    console.log("UNCOVERED: ", JSON.stringify(uncovered_dates));


    $.each(uncovered_dates,function(index,value) {
    	var req_str = "https://openexchangerates.org/api/historical/" + value.toJSON().substring(0,10) + ".json?app_id=36646cf83ce04bc1af40246f9015db65"
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
	// console.log("WINNOWING AWAY");
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
	    // console.log(JSON.stringify(exp_trans.date));
	    exp_trans.currency_symbol = $scope.currSymbol(exp_trans.currency);
	    exp_trans.color = (exp_trans.amount >= 0)?'success':'danger';
	    if (!$scope.exchangeRates[exp_trans.date] && exp_trans.currency != 'USD') {
	    	console.log('help me! ', JSON.stringify(exp_trans.date));
	    }
	    exp_trans.dollar_amount = (exp_trans.currency == 'USD')?exp_trans.amount:exp_trans.amount/$scope.exchangeRates[exp_trans.date];

	    return exp_trans;
	};
	
	var _datastore = null;
	var _accountTable = null;
	var _transactionTable = null;
	var _exchangeTable = null;
	var latest_date = new Date(0);

	// for adding stuff
	$scope.newAcct = {name:'', curr:'USD'};
	$scope.newTrans = {
	    date: '',
	    amount: '',
	    category: '',
	    note: '',
	    account: '',
	    tags : ''
	};
	$scope.column_headers= ['None','Date','Amount','Credit','Debit','Category','Note','Tags',];
	$scope.newTransactions = {
	    data: [],
	    account: null,
	    date_fmt: 'mm/dd/yy',
	    debits_negative: "1",
	    //credits negative/invert amounts?  (Citi card)
	    cols: []
	};
	// data holders
	$scope.accounts = [];
	$scope.transactions = {};
	$scope.filteredTransactions = [];
	$scope.categories = {};
	$scope.plan_categories = {}; // not used yet
	$scope.tags = {};
	$scope.exchangeRates = {};
	// filters
	$scope.acctDate = {date:''};
	$scope.catDate = {
	    start: '',
	    end: ''
	};
	$scope.tagDate = {
	    start: '',
	    end: ''
	};
	$scope.trans_filter = {
	    date_min:'',
	    date_max:'',
	    amount_min:'',
	    amount_max:'',
	    category:'',
	    note:'',
	    account:'',
	    tags: ''
	};
	$scope.loc_trans_filter = {
	    date_min:'',
	    date_max:'',
	    amount_min:'',
	    amount_max:'',
	    category:'',
	    note:'',
	    account:'',
	    tags: ''
	};

	// editing which
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
	
	var catFilter = function(transaction) {
	    // console.log(JSON.stringify($scope.loc_trans_filter))
	    var cat_pat = new RegExp($scope.loc_trans_filter.category,'gi');
	    var note_pat = new RegExp($scope.loc_trans_filter.note,'gi');
	    var acct_pat = new RegExp($scope.loc_trans_filter.account,'gi');
	    var tag_pat = new RegExp($scope.loc_trans_filter.tags,'gi');
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
	    
	    return cat_pat.test(transaction.category) &&
		note_pat.test(transaction.note) &&
		acct_pat.test(transaction.acct) &&
		tag_match &&
		min_test && max_test &&
		date_min && date_max;
	};
	
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

	$scope.$watchCollection('catDate', function(newvals, oldvals) {
	    $scope.categories = $scope.getCatBalances();
	});

	$scope.$watchCollection('acctDate', function(newvals, oldvals) {
	    angular.forEach($scope.accounts, function(acct) {
		acct.balance = $scope.getBalance(acct.acct);
	    });
	});

	$scope.$watchCollection('tagDate', function(newvals, oldvals) {
	    $scope.tags = $scope.getTagBalances();
	});
	
	var filterTimeout;
	$scope.$watchCollection('trans_filter', function(newvals, oldvals) {
	    if (filterTimeout) {
		$timeout.cancel(filterTimeout);
	    };
	    filterTimeout = $timeout(function() {
		$scope.loc_trans_filter = angular.copy(newvals);
	    },500);
	});
	
	// var dropox_owner_name = '';
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
		    // rate_date.setHours(0,0,0,0);
		    // console.log(JSON.stringify(rate_date));
		    if (rate_date > latest_date) {
			latest_date = rate_date;
		    };
		    $scope.exchangeRates[rate_date] = temp_rates[ndx].get('rate');
		};
		_datastore.SubscribeRecordsChanged(function(records) {
		    for (var ndx in records ){
			var rate_date = records[ndx].get('date');
			// rate_date.setHours(0,0,0,0);
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
			    var val_date = new Date(value['date']);
			    val_date = new Date(Date.UTC(val_date.getFullYear(),
						     val_date.getMonth(),
						     val_date.getDate()));
			    if (val_date.getTime() > last_date.getTime()) {
				// console.log("found date: ", JSON.stringify(val_date));
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
			console.log("Latest date with known exchange rate: " + JSON.stringify(latest_date));
			update_exch_rates(latest_date,_exchangeTable);
		    });
		
	
		angular.forEach(_transactionTable.query(), function(record) {
		    $scope.transactions[record.getId()] = extractData(record);
		});
		
		$scope.categories = $scope.getCatBalances();
		$scope.tags = $scope.getTagBalances();


		_datastore.SubscribeRecordsChanged(function(records) {
		    angular.forEach(records, function(record) {
			if (record.isDeleted()) {
			    delete $scope.transactions[record.getId()];
			} else {
			    $scope.transactions[record.getId()] = extractData(record);
			};
		    });
		    angular.forEach($scope.accounts, function(acct) {
			acct.balance = $scope.getBalance(acct.acct);
		    });
		    $scope.categories = $scope.getCatBalances();
		    $scope.tags = $scope.getTagBalances();
		}, 'transactions');
	    });
	
	$scope.getBalance = function(account) {
	    var acct_date = new Date();
	    if ($scope.acctDate.date != '') {
		acct_date = new Date($scope.acctDate.date);
	    }
	    var acct_trans = _transactionTable.query({"Account": account.getId()});
	    var total = 0.0;
	    for (var ndx in acct_trans) {
		var trans = acct_trans[ndx];
		if (trans.get('Date') <= acct_date) {
		    total += trans.get('Amount');
		};
	    }
	    return total;
	};
	
	$scope.getCatBalances = function() {
	    var start_date = new Date(0);
	    var end_date = new Date();
	    var categories = {};
	    if ($scope.catDate.start != '') {
		start_date = new Date($scope.catDate.start);
	    };
	    if ($scope.catDate.end != '') {
		end_date = new Date($scope.catDate.end);
	    };
	    angular.forEach($scope.transactions, function(trans, ndx) {
		if (trans.date >= start_date && trans.date <= end_date) {
		    categories[trans.category] = (categories[trans.category] || 0) + trans.dollar_amount;
		};
	    });
	    return categories;
	};

	$scope.getTagBalances = function() {
	    var tags = {};
	    var start_date = new Date(0);
	    var end_date = new Date();
	    if ($scope.tagDate.start != '') {
		start_date = new Date($scope.tagDate.start);
	    };
	    if ($scope.tagDate.end != '') {
		end_date = new Date($scope.tagDate.end);
	    };
	    angular.forEach($scope.transactions, function(trans, ndx) {
		if (trans.date >= start_date && trans.date <= end_date) {
		    angular.forEach(trans.tags, function(value) {
			tags[value] = (tags[value] || 0) + trans.dollar_amount;
		    });
		};
	    });
	    delete tags['None'];
	    return tags;
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
	
	$scope.addAccount = function() {
	    _accountTable.insert({
		acctname: $scope.newAcct.name,
		currency: $scope.newAcct.curr
	    });
	};
	
	$scope.addTransaction = function() {
	    var date = new Date($scope.newTrans.date);
	    date = new Date(Date.UTC(date.getFullYear(),
				     date.getMonth(),
				     date.getDate()));	    
	    var tag_arr = $scope.newTrans.tags.split(',');
	    for (var ndx in tag_arr) {
		tag_arr[ndx] = tag_arr[ndx].trim();
	    };
	    _transactionTable.insert({
		Date: date,
		Amount: Number($scope.newTrans.amount),
		Category: $scope.newTrans.category,
		Note: $scope.newTrans.note,
		Account: $scope.newTrans.account.acct.getId(),
		Tags: tag_arr
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
	    console.log(JSON.stringify($scope.edit_tags.repl));
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
	
	$scope.saveIt = function() {
	    var new_transactions = [];
	    angular.forEach($scope.newTransactions.data, function(record,indx) {
		var new_trans = {Date:'', Amount:0.0, Category:'',Note:'',Account:'', Tags:''};
		angular.forEach($scope.newTransactions.cols, function(val, ndx) {
		    if ($scope.column_headers.indexOf(val) > 0 ){
			if (val == 'Note') {
			    new_trans[val] += ' ' + record[ndx];
			} else {
			    new_trans[val] = record[ndx];
			};
		    }
		});
		var tmp_date = angular.element.datepicker.parseDate($scope.newTransactions.date_fmt,
									 new_trans['Date']);
		new_trans['Date'] = new Date(Date.UTC(tmp_date.getFullYear(),
						      tmp_date.getMonth(),
						      tmp_date.getDate()));
		new_trans['Account'] = $scope.newTransactions.account.acct.getId();
		// sometimes there's a $ at the front (Citi card)
		if (new_trans.hasOwnProperty('Credit') && (new_trans['Credit'].trim() != '')) {
		    new_trans['Amount'] = Number(new_trans['Credit'].replace(/\$/,''));
		    delete new_trans['Credit'];
		} else if (new_trans.hasOwnProperty('Debit') && (new_trans['Debit'].trim() != '')) {
		    new_trans['Amount'] = Number(new_trans['Debit'].replace(/\$/,''));
		    delete new_trans['Credit'];
		} else if (new_trans.hasOwnProperty('Amount') && (new_trans['Amount'].trim() != '')) {
		    new_trans['Amount'] = Number(new_trans['Amount'].replace(/\$/,''));
		};
		new_trans['Amount'] = new_trans['Amount']*Number($scope.newTransactions['debits_negative']);
		new_trans['Tags'] = new_trans['Tags'].split(',');
		for (var ndx in new_trans['Tags']) {
		    new_trans['Tags'][ndx] = new_trans['Tags'][ndx].trim();
		};
		_transactionTable.insert(new_trans);
	    });
	    angular.element('#importModal').modal('hide');
	};
    });

app.directive('dbChooser', function($http) {
    return {
	// template: '<input type="dropbox-chooser" name="selected-file"'
	//     + ' style="visibility:hidden;" data-link-type="direct"'
	//     + 'id="db-chooser" />',
	template: '<button class="btn btn-default btn-xs">Upload from Dropbox</button>',
	link: function(scope, element, attrs) {
	    console.log(element);
	    element.on('click', function() {
		Dropbox.choose({
		    success: function(files) {
			$http.get(files[0].link)
			    .success(function(data, status, headers, config) {
				var temp_data = angular.element.csv.toArrays(data);
				var max_num_cols = 0;
				angular.forEach(temp_data, function(val) {
				    if (val.length > max_num_cols) {
					max_num_cols = val.length;
				    };
				});
				scope.newTransactions.data = temp_data;
				scope.newTransactions.cols = [];
				for (var ndx = 0; ndx < max_num_cols; ndx++) {
				    // scope.newTransactions.cols.push(ndx);
				    scope.newTransactions.cols.push('None');
				};
				// console.log(JSON.stringify(scope.newTransactions));
				angular.element('#importModal').modal('show');
			    });
		    },
		    linkType: "direct"
		});
	    });
	}

    };
});
