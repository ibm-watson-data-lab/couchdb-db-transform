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

const consts = require('./consts');
const debug = require('debug')(consts.appPrefix + ':transform');

var transformFunction = null;

// load custom transform function, if one was specified
if(process.env.TRANSFORM_FUNCTION) {
	debug('Trying to load custom transformation routine from file "' + process.env.TRANSFORM_FUNCTION + '"');	
	try {
		transformFunction = require(require('path').join(process.cwd(),process.env.TRANSFORM_FUNCTION));
		if(typeof transformFunction === 'function') {
			console.log('Loaded custom transformation function from file "' + process.env.TRANSFORM_FUNCTION + '".');
		}
		else {
			console.error('File "' + process.env.TRANSFORM_FUNCTION + '" does not export a function.');	
			console.error('Service is terminating.');
			process.exit(1);
		}
	}
	catch(error) {
		console.error('Fatal error. Transformation function could not be loaded from file "' + process.env.TRANSFORM_FUNCTION + '": ' + error);
		console.error('Service is terminating.');
		process.exit(1);
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

			try {
		 			// apply custom transformation	
		 			doc = transformFunction(doc);	
			}
			catch(err) {
				console.error('Custom transformation function defined in "' + process.env.TRANSFORM_FUNCTION + '" caused a fatal error: ' + err);
				process.exit(1);
			}
		}

		debug('Transformed document ' + JSON.stringify(doc));
	}
	
	return doc;
};