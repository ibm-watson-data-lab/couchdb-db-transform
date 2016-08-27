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

const debug = require('debug')('cloudant-replication-cleansing:filter');

debug('Loading filter routine.');

/*
 * Filter function.
 * @param {Object} change - the change request
 * @param {String} change.id - the unique document id
 * @param {Boolean} change.deleted - indicates that that this document was deleted
 * @param {Object} change.doc - the document
 * @returns {boolean} - true if this document should be ignored (not replicated)
 */
module.exports = function(change) {
	
	var ignoreDoc = true;

	// invalid input
	if((! change) || (! change.doc)) {
		return ignoreDoc;
	}

	if(!change.hasOwnProperty('deleted')) {
		// process this change
		ignoreDoc = false;
	}

	return ignoreDoc;

};