'use strict';

var app = angular.module(
    'spendPlan',
    ['ngRoute', 'dropstore-ng','ui.bootstrap','spDirectives', 'spFilters','spHelpers','spServices'])
    .config(
	['$routeProvider', 'datepickerConfig', 
	 function ($routeProvider, datepickerConfig) {
	     datepickerConfig.showWeeks = false;
	     $routeProvider.when('/transactions', {
		 templateUrl: 'partials/transactions.html',
		 controller: 'SpendPlanCtrl'
	     })
	     .when('/accounts', {
		 templateUrl: 'partials/accounts.html',
		 controller: 'SpendPlanCtrl'
	     })
	     .when('/categories', {
		 templateUrl: 'partials/categories.html',
		 controller: 'SpendPlanCtrl'
	     })
	     .when('/tags', {
		 templateUrl: 'partials/tags.html',
		 controller: 'SpendPlanCtrl'
	     })
	     .when('/', {
		 templateUrl: 'partials/summary.html',
		 controller: 'SpendPlanCtrl'
	     })
	     .otherwise({
		 redirectTo: '/'
	     });

	 }]);

app.controller(
    'SpendPlanCtrl', 
    function SpendPlanCtrl($scope, $timeout, $http, $rootScope,
			   dictValFilter, orderByFilter, 
			   transLimiter, spRecordService) {
	
	// console.log(JSON.stringify(spRecordService));


	// for adding stuff
	$scope.newAcct = {name:'', curr:'USD'};
	$scope.newTrans = 
	    {date: '', amount: '', category: '', note: '', account: '', tags: ''};
	$scope.column_headers = 
	    ['None', 'Date', 'Amount', 'Credit', 'Debit', 'Category', 'Note', 'Tags'];
	$scope.newTransactions = {
	    data: [],
	    account: null,
	    date_fmt: 'mm/dd/yy',
	    debits_negative: "1",
	    //credits negative/invert amounts?  (Citi card)
	    cols: []
	};
	$scope.newSplit = {amount: 0, cat: ''}
	// data holders
	$scope.accounts = []; // spRecordService.accounts;
	$scope.transactions = spRecordService.transactions;
	$scope.filteredTransactions = [];
	$scope.categories = {}; // spRecordService.getCatBalances();
	$scope.catnames = []; 
	$scope.plan_categories = {}; // not used yet
	$scope.tags = []; //spRecordService.tags;
	$scope.exchangeRates = {};
	// filters
	$scope.acctDate = {date:''};
	$scope.catDate = {start: '', end: ''};
	$scope.tagDate = {start: '', end: ''};
	$scope.trans_filter = 
	    {date_min:'', 
	     date_max:'', 
	     amount_min:'', 
	     amount_max:'', 
	     category:'', 
	     note:'', 
	     account:[], 
	     tags: ''};

	$scope.pager = {page_num: 1, num_pages: 1 };

	// editing which
	$scope.edit_category = {tran: null, repl: ""};
	$scope.edit_note = {tran: null, repl: ""};
	$scope.edit_tags = {tran: null, repl: ""};
	$scope.edit_splits = {tran: null, repl: "", add_cat: "", add_amt: 0};
	

	$scope.change_page = function(idx) {
	    $scope.pager.page_num += idx;
	    $scope.filteredTransactions = 
		orderByFilter(
		    dictValFilter(spRecordService.transactions,
				  transLimiter,
				  $scope.trans_filter),
		    'date',true)
		.slice(($scope.pager.page_num-1)*100, 
		       $scope.pager.page_num*100);
	};

	$scope.$watchCollection('catDate', function(newvals, oldvals) {
	    $scope.categories = spRecordService.getCatBalances($scope.catDate);
	});

	$scope.$watchCollection('acctDate', function(newvals, oldvals) {
	    $scope.accounts = spRecordService.getAcctBalances($scope.acctDate.date);
	});

	$scope.$watchCollection('tagDate', function(newvals, oldvals) {
	    $scope.tags = spRecordService.getTagBalances($scope.tagDate);
	});

	var filterTimeout;

	$scope.$watchCollection('transactions', function() { 
	    if (filterTimeout) {
		$timeout.cancel(filterTimeout);
	    };
	    filterTimeout = $timeout(function() {
		var tempFiltTrans = orderByFilter(
		    dictValFilter(spRecordService.transactions,transLimiter,$scope.trans_filter),
		    'date',true);
		$scope.pager.num_pages = Math.ceil(tempFiltTrans.length/100);
		$scope.filteredTransactions = tempFiltTrans
		    .slice(($scope.pager.page_num-1)*100, 
			   $scope.pager.page_num*100);
		$scope.accounts = spRecordService.getAcctBalances();
		$scope.categories = spRecordService.getCatBalances();
		$scope.catnames = [];
		angular.forEach($scope.categories, function(val,key) {
		    $scope.catnames.push(key);
		});
		$scope.tags = spRecordService.getTagBalances();
		$scope.monthly = spRecordService.getMonthlySummary();
	    }, 500);
	});

	$scope.$watchCollection('trans_filter', function(newvals, oldvals) {
	    if (filterTimeout) {
		$timeout.cancel(filterTimeout);
	    };
	    filterTimeout = $timeout(function() {
		$scope.pager.page_num = 1;
		// console.log('here we go');
		// console.log($scope.trans_filter.account);
		var tempFiltTrans = orderByFilter(
		    dictValFilter(spRecordService.transactions,
				  transLimiter,
				  $scope.trans_filter),
		    'date',
		    true);
		$scope.pager.num_pages = Math.ceil(tempFiltTrans.length/100);
		$scope.filteredTransactions = tempFiltTrans
		    .slice(($scope.pager.page_num-1)*100, 
			   $scope.pager.page_num*100);
	    },500);
	});
	
	$scope.open = function($event, dateOpts, opener) {
	    $event.preventDefault();
	    $event.stopPropagation();
	    console.log(opener);
	    if (!opener) {
		opener = 'opened';
	    };
	    dateOpts[opener] = true;
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
	    spRecordService.addTransaction({
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
	
	$scope.showSplits = function(transaction) {
	    $scope.edit_splits.add_cat = "";
	    $scope.edit_splits.add_amt = 0;
	    if ($scope.edit_splits.tran == transaction) {
		$scope.edit_splits.tran = null;
	    } else {
		$scope.edit_splits.tran = transaction;
	    }

	};

	$scope.mainAmount = function(transaction) {
	    var total = transaction.amount;
	    angular.forEach(transaction.splits, function(val, key) {
		total -= val;
	    });
	    return total;
	};

	$scope.addSplit = function(transaction) {
	    if ($scope.edit_splits.add_cat) {
		transaction.splits[$scope.edit_splits.add_cat] = $scope.edit_splits.add_amt;
		$scope.edit_splits.add_cat = "";
		$scope.edit_splits.add_amt = 0;
	    };
	};

	$scope.removeSplit = function(transaction, category) {
	    delete transaction.splits[category];
	};

	$scope.saveSplits = function(transaction) {
	    var trans_splits = transaction.trans.getOrCreateList('Splits');
	    var split_arr = trans_splits.toArray();
	    var cur_num_splits = trans_splits.length();
	    for (var ndx = 0; ndx < cur_num_splits; ndx ++) {
		trans_splits.pop();
	    }
	    console.log(transaction.splits);
	    angular.forEach(transaction.splits, function(val, key) {
		console.log(key, ":" , val);
		trans_splits.push(key);
		trans_splits.push(Number(val));
	    });
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
		spRecordService.addTransaction(new_trans);
	    });
	    angular.element('#importModal').modal('hide');
	};
    });
