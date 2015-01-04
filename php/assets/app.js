'use strict';

var app = angular.module(
    'spendPlan',
    ['ngRoute', 'dropstore-ng','ui.bootstrap','spControllers', 
     'spDirectives', 'spFilters','spHelpers','spServices'])
    .config(
	['$routeProvider', 'datepickerConfig', 
	 function ($routeProvider, datepickerConfig) {
	     datepickerConfig.showWeeks = false;
	     $routeProvider.when('/transactions', {
		 templateUrl: 'partials/transactions.html'
	     })
	     .when('/help' ,{
		 templateUrl: 'partials/help.html'
	     })
	     .when('/accounts', {
		 templateUrl: 'partials/accounts.html'
	     })
	     .when('/categories', {
		 templateUrl: 'partials/categories.html'
	     })
	     .when('/tags', {
		 templateUrl: 'partials/tags.html'
	     })
	     .when('/analysis', {
		 templateUrl: 'partials/analysis.html'
	     })
	     .when('/', {
		 templateUrl: 'partials/summary.html'
	     })
	     .otherwise({
		 redirectTo: '/'
	     });

	 }]);
