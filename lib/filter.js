//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2016
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

const async = require('async');
const consts = require('./consts.js');
const debug = require('debug')(consts.appPrefix + ':filter');
const path = require('path');

/*
 * Class makes server-side and client-side filters available that can be applied
 * to a CouchDB change feed. Unlike https://github.com/iriscouch/follow, this 
 * filter does allow for both filters to be present, to optimize processing.
 * 
 * The constructor of this class is protected to prevent instantiation without 
 * prior validation.
 * 
 * @param {Object} serverFilter - optional; configuration for server-side filter
 * @param {String} serverFilter.id - "designDocName/filterName" that will be used to filter the change feed at the source
 * @param {Function} serverFilter.definition - the filter definition
 * @param {Object} clientFilter - optional; configuration for client-side filter
 * @param {String} clientFilter.id - "filename" that contains the filter definition
 * @param {Function} clientFilter.definition - the filter definition
 */
function Filter(serverFilter, clientFilter) {

	this.serverFilterName = null;
	this.serverFilterDefinition = null;

	if(serverFilter) {
		this.serverFilterName = serverFilter.id;				// "design_doc/filter"
		this.serverFilterDefinition = serverFilter.definition;	// javascript
		debug('Creating server-side filter: ' + JSON.stringify(serverFilter));
	}

	this.clientFilterName = null;
	this.clientFilterDefinition = null;

	if(clientFilter) {
		this.clientFilterName = clientFilter.id; 				// a file name
		this.clientFilterDefinition = clientFilter.definition;	// javascript
		debug('Creating client-side filter: ' + JSON.stringify(clientFilter));
	}
}

/*
 * @returns {Boolean} - true if a server-side filter is defined, false otherwise
 */
Filter.prototype.hasServerFilter = function() {
	return (this.serverFilterName !== null);
};

/*
 * Returns the design document name and filter name of the server-side filter, or null if not defined.
 * @returns {String} - the filter name expressed as "designDocName/filterName", or null, if not defined
 */
Filter.prototype.getServerFilterName = function() {
	return this.serverFilterName;
};

 /*
 * Returns the server-side filter function definition
 * @returns {String} - the filter function text or null, if not defined
 */
Filter.prototype.getServerFilterDefinition = function() {
	if(this.serverFilterDefinition) {
		return this.serverFilterDefinition.toString();
	}
	return null;
};

/*
 * @returns {Boolean} - true if a client-side filter is defined; false otherwise
 */
Filter.prototype.hasClientFilter = function() {
	return (this.clientFilterDefinition !== null);
};

/*
 * @returns {String} - name of the file containing the client-side filter function, if one is defined; null otherwise
 */
Filter.prototype.getClientFilterName = function() {
	return this.clientFilterName;
};
/*
 * @returns {Function} - the client-side filter function, if one is defined; null otherwise
 */
Filter.prototype.getClientFilter = function() {
	return this.clientFilterDefinition;
};

 /*
 * Returns the client-side filter function definition
 * @returns {String} - the filter function text or null, if not defined
 */
Filter.prototype.getClientFilterDefinition = function() {
	if(this.clientFilterDefinition) {
		return this.clientFilterDefinition.toString();
	}
	return null;
};

/*
 * Determines whether <change> should be kept or ignored. A change is ignored if <change>
 * (1) is null/undefined, (2) doesn't contain the "doc" property, (3) the client-side filter evaluates to false or (4) a fatal
 *  error is encountered
 * @param {Object} change - a change object, as provided by https://github.com/iriscouch/follow when the "change" event is emitted
 * @returns {Boolean} - true if the change should be applied to the target database
 */
Filter.prototype.applyClientFilter = function(change) {

	if((! change) || (!change.doc)) {
		return false;	// invalid input; reject
	}

	if(! this.hasClientFilter()) {
		return true;	// no filter was specified. all changes will be propagated
	}

	try {
		return this.clientFilterDefinition(change); // custom filter function determines fate of this change
	}
	catch(err) {
		console.error('Document filter function in file "' + process.env.CLIENT_FILTER + '" caused a fatal error: ' + err);
		console.error('Change:' + JSON.stringify(change));
		console.error('Filter:' + this.clientFilterDefinition);
		return false;
	}
};

/*
 * Create a filter based on the content of environment variables SERVER_FILTER ("<design_doc_name>/<filter_name>") and 
 * CLIENT_FILTER ("<path/to/client_filter_js>"). If either variable is defined it must contain a valid value. 
 *
 * @param: {Object}
 * @param: {Callback} callback - invoked with (err, Filter) parameters
 * @returns: {String} err - if any validation issues were encountered
 * @returns: {Object} Filter - a validated filter
 */
var getFilter = function(database, callback){

	// verify that valid filters can be configured
	// (1) server-side filter (don't add documents to the change feed)
	// (2) client-side filter (ignore documents that are in the change feed)

	async.parallel({
					serverFilter: function(serverFilterCallback) {

						if(process.env.SERVER_FILTER) {

							debug('Environment variable SERVER_FILTER is set to "' + process.env.SERVER_FILTER + '".');

							var filterInfo = process.env.SERVER_FILTER.split(/\//, 2);
							if((filterInfo.length !== 2) || (! filterInfo[0]) || (! filterInfo[1])) {
								// expected format: <design_doc_id>/<filter_id>
								return serverFilterCallback('[Configuration error] Environment variable SERVER_FILTER does not identify a design document containing a filter.');
							}
			
							database.get('_design/' + filterInfo[0], 
										 function(err, body) {

										 	if(err) {
										 		return serverFilterCallback('[Configuration error] Environment variable SERVER_FILTER refers to design document "' + filterInfo[0] + '" which could not be located in the source database: ' + err);
										 	}
										 	
										 	debug('Found design document:' + JSON.stringify(body));

										 	if(body.filters && body.filters[filterInfo[1]]) {
										 		// the filter was found in the design document; 
										 		console.log('Server-side filter "' + filterInfo[1] + '" was found in design document "' + filterInfo[0] + '" in the source database.');
										 		debug('[-------- server-side filter definition --------]\n' +
										 			  body.filters[filterInfo[1]] + '\n' + 
										 			  '[-----------------------------------------------]');
												return serverFilterCallback(null, {'id': process.env.SERVER_FILTER, 'definition': body.filters[filterInfo[1]]});
										 	}
										 	else {
										 		return serverFilterCallback('[Configuration error] Design document "' + filterInfo[0] + '" in the source database does not define a filter named "' + filterInfo[1] + '".');
										 	}							 	
										 });
						}
						else {
							console.log('No server-side filter was declared. All changes will be added to the change feed.');
							// server-side filter was not declared
							return serverFilterCallback(null, null);
						}

					},
					clientFilter: function(clientFilterCallback) {

						if(process.env.CLIENT_FILTER) {

							debug('Environment variable CLIENT_FILTER is set to "' + process.env.CLIENT_FILTER + '".');

							try {
								var filterFunction = require(path.join(process.cwd(), process.env.CLIENT_FILTER));
								if(typeof filterFunction === 'function') {
									console.log('Client-side filter routine was loaded from file "' + process.env.CLIENT_FILTER + '".');
									debug('[-------- client-side filter definition --------]\n' +
									      filterFunction.toString() + '\n' + 
									      '[-----------------------------------------------]');
									return clientFilterCallback(null, {'id': process.env.CLIENT_FILTER, 'definition': filterFunction});
								}
								else {
									return clientFilterCallback('The file "' + process.env.CLIENT_FILTER + '" does not export a function.');
								}
							}
							catch(error) {
								return clientFilterCallback('Custom document filter function could not be loaded from file "' + process.env.CLIENT_FILTER + '": ' + error);
							}
						}
						else {
							console.log('No client-side filter was declared. All document changes will be processed.');
							return clientFilterCallback(null, null);
						}
					}
				   },
				   function(err, results) {

				   		if(err) {
				   			return callback('Filter initialization failed: ' + err);
				   		}

				   		return callback(null, new Filter(results.serverFilter, results.clientFilter));
				   });

};

// export getter
module.exports.getFilter = getFilter;
