'use strict';

angular.module(
    'spServices', 
    ['dropstore-ng', 'spHelpers'])
    .factory(
	'spRecordService', 
	['$http', 'dropstoreClient', 'updateExchangeRates', 'extractData','dateFilter',
	 function($http, dropstoreClient, updateExchangeRates, extractData, dateFilter) {
	     var holder = {};
	     var _datastore = null;
	     var _accountTable = null;
	     var _transactionTable = null;
	     var _exchangeTable = null;
	     var latest_date = new Date(0);


	     var currSymbol = function(trigraph) {
		 if (trigraph == 'USD') {
		     return '$';
		 } else if (trigraph == 'GBP') {
		     return '£';
		 } else {
		     return "ERR";
		 }
	     };

	     var splitify = function(t) {
		 var cats = {};
		 var main_amt = t.dollar_amount;
		 angular.forEach(t.splits, function(val, cat) {
		     main_amt -= val.dollar_amount;
		     cats[cat] = val.dollar_amount;
		 });
		 cats[t.category] = main_amt;
		 return cats;
	     };

	     holder.addTransaction = function(newTrans) {
		 _transactionTable.insert(newTrans);
	     };

	     holder.getAcctBalances = function(acctDate) {
	     	 var acct_date = new Date();
	     	 if (acctDate && acctDate != '') {
	     	     acct_date = new Date(acctDate);
	     	 }
		 var to_return = [];
		 angular.forEach(holder.accounts, function(acct, ndx) {
		     acct.balance = 0.0;
		     to_return.push(acct);
		 });
		 angular.forEach(holder.transactions, function(trans, ndx) {
	     	     if (trans.date <= acct_date) {
	     		 holder.accounts[trans.acct_id].balance += trans.amount;
	     	     };
	     	 });
		 // console.log(to_return);
		 // console.log(holder.accounts);
	     	 return to_return;
	     };

	     holder.getMonthlySummary = function() {
		 var monthlies = {};
		 var monthlist = [];
		 angular.forEach(holder.transactions, function(trans, ndx) {
		     var anchor = new Date(trans.date.getFullYear(), trans.date.getMonth());
		     var month = dateFilter(anchor, 'MMMM yyyy');
		     if (!(anchor in monthlies)) {
			 monthlies[anchor] = {month: month,
					      anchor: anchor,
					      amt_in: 0, 
					      amt_out: 0
					     };
		     }
		     if (trans.category.toLowerCase() != "transfer") {
			 if (trans.dollar_amount > 0) {
			     monthlies[anchor].amt_in += trans.dollar_amount;
			 } else {
			     monthlies[anchor].amt_out += trans.dollar_amount;
			 }
		     }
		 });
		 angular.forEach(monthlies, function(month, ndx) {
		     monthlist.push(month);
		 });
		 return monthlist;
	     };

	     holder.getCatBalances = function(dates) {
		 var start_date = new Date(0);
		 var end_date = new Date();
		 var categories = {};
		 if (dates && dates.start != '') {
		     start_date = new Date(dates.start);
		 };
		 if (dates && dates.end != '') {
		     end_date = new Date(dates.end);
		 };
		 angular.forEach(holder.transactions, function(trans, ndx) {
		     if (trans.date >= start_date && trans.date <= end_date) {
			 angular.forEach(splitify(trans), function(amt, cat) {
			     categories[cat] = (categories[cat] || 0) + amt;
			 });
		     };
		 });
		 return categories;
	     };
	     
	     holder.getTagBalances = function(dates) {
		 var tags = {};
		 var start_date = new Date(0);
		 var end_date = new Date();
		 if (dates && dates.start != '') {
		     start_date = new Date(dates.start);
		 };
		 if (dates && dates.end != '') {
		     end_date = new Date(dates.end);
		 };
		 angular.forEach(holder.transactions, function(trans, ndx) {
		     if (trans.date >= start_date && trans.date <= end_date) {
			 angular.forEach(trans.tags, function(value) {
			     tags[value] = (tags[value] || 0) + trans.dollar_amount;
			 });
		     };
		 });
		 delete tags['None'];
		 return tags;
	     }
	     
	     holder.newAcct = {name:'', curr:'USD'};
	     holder.newTrans = 
		 {date: '', amount: '', category: '', note: '', account: '', tags: ''};
	     holder.column_headers = 
		 ['None', 'Date', 'Amount', 'Credit', 'Debit', 'Category', 'Note', 'Tags'];
	     holder.newTransactions = {
		 data: [],
		 account: null,
		 date_fmt: 'mm/dd/yy',
		 debits_negative: "1",
		 //credits negative/invert amounts?  (Citi card)
		 cols: []
	     };

	     holder.accounts = {};
	     holder.transactions = {};
	     holder.filteredTransactions = [];
	     holder.categories = {};
	     holder.plan_categories = {}; // not used yet
	     holder.tags = {};
	     holder.exchangeRates = {};

	     // editing which
	     holder.edit_category = {tran: null, repl: ""};
	     holder.edit_note = {tran: null, repl: ""};
	     holder.edit_tags = {tran: null, repl: ""};
	     holder.edit_splits = {tran: null, repl: "", add_cat: "", add_amt: 0};
	     
	     dropstoreClient.create({key: "i86ppgkz7etf1vk"})
		 .authenticate({interactive: true})
		 .then(function(datastoreManager) {
		     // console.log('completed authentication');
		     // dropstoreClient.getAccountInfo({}, function(error, acctinfo, acct_json) {
		     //     dropbox_owner_name = acctinfo.name;
		     //     console.log(dropbox_owner_name);
		     // });
		     return datastoreManager.openDefaultDatastore();
		 })
		 .then(function(datastore) {
		     var extractAcct = function(account) {
			 return {
			     acct: account,
			     name: account.get('acctname'),
			     acct_id: account.getId(),
			     currency: account.get('currency'),
			     currency_symbol: currSymbol(account.get('currency')),
			     balance: 0
			 };
		     };
		     
		     _datastore = datastore;
		     
		     _transactionTable = _datastore.getTable('transactions');
		     _accountTable = _datastore.getTable('accounts');
		     
		     holder.acctTable = _accountTable;

		     var temp_accounts = _accountTable.query();
		     for (var ndx in temp_accounts) {
			 var extracted = extractAcct(temp_accounts[ndx]);
			 holder.accounts[extracted.acct_id] = extracted;
		     };
		     // holder.newTrans.account = holder.accounts[0];
		     
		     _datastore.SubscribeRecordsChanged(function(records) {
			 for (var ndx in records ){
			     holder.accounts.push(extractAcct(records[ndx]));
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
			 holder.exchangeRates[rate_date] = temp_rates[ndx].get('rate');
		     };
		     _datastore.SubscribeRecordsChanged(function(records) {
			 for (var ndx in records ){
			     var rate_date = records[ndx].get('date');
			     // rate_date.setHours(0,0,0,0);
			     if (rate_date > latest_date) {
				 latest_date = rate_date;
			     };
			     holder.exchangeRates[rate_date] = records[ndx].get('rate');
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
			     updateExchangeRates(latest_date,_exchangeTable);
			 });
		     
		     
		     angular.forEach(_transactionTable.query(), function(record) {
			 holder.transactions[record.getId()] = 
			     extractData(record,
					 holder.acctTable.get(record.get('Account')),
					 holder.exchangeRates[record.get('Date')]);
		     });

		     _datastore.SubscribeRecordsChanged(function(records) {
			 angular.forEach(records, function(record) {
			     if (record.isDeleted()) {
				 delete holder.transactions[record.getId()];
			     } else {
				 holder.transactions[record.getId()] = 
				     extractData(record,
						 holder.acctTable.get(record.get('Account')),
						 holder.exchangeRates[record.get('Date')]);
			     };
			 });
		     }, 'transactions');
		 });

	     return holder;
	 }]);
