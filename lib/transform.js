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

const debug = require('debug')('cloudant-replication-cleansing:transform');

var transformFunction = null;

// load custom transform function, if one was specified
if(process.env.TRANSFORM_FUNCTION) {
	debug('Loading custom transform routine.');	
	try {
		transformFunction = require(require('path').join(process.cwd(),process.env.TRANSFORM_FUNCTION));
		if(typeof transformFunction === 'function') {
			console.log('Loaded custom transform function from file "' + process.env.TRANSFORM_FUNCTION + '".');
		}
		else {
			console.error('File "' + process.env.TRANSFORM_FUNCTION + '" does not export a function.');	
			console.error('Using default (noop) transform routine.');
		}
	}
	catch(error) {
		console.error('Transform function could not be loaded from file "' + process.env.TRANSFORM_FUNCTION + '": ' + error);
		console.error('Using default (noop) transform routine.');
	}
}
else {
	console.log('No custom transformation routine was specified. No document transformation will be performed.');		
}

/*
 * Transformation function wrapper. Invoked before a document is replicated 
 * to the target database
 * @param {Object} doc - the source document
 * @returns {Object} - the transformed document, which will be stored in the target database
 */
module.exports = function(doc) {

	if(doc) {
		debug('Transforming document ' + doc._id);
		
		if(transformFunction) {
		 // apply custom transformation	
		 doc = transformFunction(doc);	
		}

		debug('Transformed document ' + JSON.stringify(doc));
	}
	
	return doc;
};