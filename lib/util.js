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

const url = require('url');
const fs = require('fs');
const debug = require('debug')('cloudant-replication-cleansing:util');

/*
 * 
 * @param {String} couchDatabaseURL - couch database URL, e.g. https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$DATABASE_NAME
 * @return {Object} credentials
 * @return {String} credentials.url - couch URL without database, e.g. https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com
 * @return {String} credentials.dbname - database name, e.g. $DATABASE_NAME
 */
const splitUrl = function(couchDatabaseURL) {

	if(couchDatabaseURL) {

		var urlObj = url.parse(couchDatabaseURL);

		if((! urlObj.pathname) || (urlObj.pathname.length === 1)) {
			return null;
		}
	
		var dbname = urlObj.pathname.substr(1);
	
		delete urlObj.pathname;
		delete urlObj.search;
		delete urlObj.hash;

		if(! url.format(urlObj)) {
			return null;
		}

		return {url: url.format(urlObj), dbname: dbname};

	}
	else {
		return null;
	}
};


/*
 * Removes password information from a credentials object
 * @param {Object} credentials
 * @param {String} credentials.url https://$USERNAME@$REMOTE_USERNAME.cloudant.com
 * @param {String} credentials.dbname $DATABASE_NAME
 * @return {Object} sanitized_credentials
 * @return {Object} sanitized_credentials.url 
 */
const getUrlWithoutPassword = function(couchUrl) {

	var safeUrl = null;

	if(couchUrl) {
		var urlObj = url.parse(couchUrl);
		urlObj.auth = urlObj.auth.split(':')[0];
		safeUrl = url.format(urlObj);
	}

	return safeUrl;
}; 

/*
 * Removes password information from a credentials object
 * @param {Object} credentials
 * @param {String} credentials.url https://$USERNAME@$REMOTE_USERNAME.cloudant.com
 * @param {String} credentials.dbname $DATABASE_NAME
 * @return {Object} sanitized_credentials
 * @return {Object} sanitized_credentials.url 
 */
const getCredentialsWithoutPassword = function(credentials) {

	var safeCredentials = null;

	if((credentials) && (credentials.url) && (credentials.dbname)) {
		var urlObj = url.parse(credentials.url);
		urlObj.auth = urlObj.auth.split(':')[0];

		safeCredentials = {
							url: url.format(urlObj),
							dbname: credentials.dbname
		};
	}
	return safeCredentials;
}; 

/*
 * Returns true if value evaluates to true
 * @param value - the value to be evaluated
 */
const isTrue = function(value) {

	value = value || false;
	return (value === true || value === 1 || value === '1');

};

/*
 * Create directory dirName if it doesn't exist yet.
 * @param dirName - directory to be created
 */
const mkdir = function(dirName) {

	if(dirName) {
		try {
			fs.accessSync(dirName, fs.W_OK);
		}
		catch(err) {
			debug('Directory ' + dirName + ' does not exist or is not writable: ' + err);
			// try to create the directory
			fs.mkdirSync(dirName);	
		}		
	}
};

module.exports.splitUrl = splitUrl;
module.exports.getUrlWithoutPassword = getUrlWithoutPassword;
module.exports.getCredentialsWithoutPassword = getCredentialsWithoutPassword;
module.exports.isTrue = isTrue;
module.exports.mkdir = mkdir;
