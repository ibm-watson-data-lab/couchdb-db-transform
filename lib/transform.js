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

const consts = require('./consts.js');
const debug = require('debug')(consts.appPrefix + ':transform');

/*
 * Class makes a transformation routine available.
 * 
 * The constructor of this class is protected to prevent instantiation without 
 * prior validation.
 * 
 * @param {Object} transformerInfo
 * @param {String} transformerInfo.id - the name of the file that contains transformerInfo.routine
 * @param {Function} transformerInfo.routine - the transformation function
 */
function Transformer(transformerInfo) {

	this.name = null;
	this.routine = null;

	if(transformerInfo) {
		this.name = transformerInfo.id;				// file name 
		this.routine = transformerInfo.routine;		// javascript
		debug('Creating server-side Transformer: ' + JSON.stringify(transformerInfo));
	}
}

/*
 * @returns {Boolean} - true if a traqnsformation routine is defined, false otherwise
 */
Transformer.prototype.hasTransformationRoutine = function() {
	return (this.routine !== null);
};

/*
 * Returns the file name of the transformation routine, or null if not defined
 * @returns {String} - transformer path/file name, or null if not defined
 */
Transformer.prototype.getName = function() {
	return this.name;
};

/*
 * Returns the transformation function
 * @returns {Function} - the transform function or null, if not defined
 */
Transformer.prototype.getRoutine = function() {
	return this.routine;
};

/*
 * Returns the transformation function definition
 * @returns {String} - the transform function text or null, if not defined
 */
Transformer.prototype.getRoutineDefinition = function() {
	if(this.routine) {
		return this.routine.toString();
	}
	return null;
};

/*
 * Invokes the transformation routine on the document. If no transformation routine is defined
 * the original document is returned.
 * @param {Object} doc - the input document 
 * @param {Callback} callback - invoked with (err, doc) when processing is complete
 */
Transformer.prototype.transform = function(doc, callback) {
	if(doc) {
		debug('Transforming document ' + doc._id);		
		if(this.hasTransformationRoutine()) {
			try {
		 		// apply custom transformation	
		 		doc = this.routine(doc);	
		 		debug('Transformed document ' + JSON.stringify(doc));
			}
			catch(err) {
				// FFDC; routine execution resulted in an error
				var message = 'Custom transformation function defined in "' + this.name + '" caused a fatal error: ' + err;
				console.error('Document: ' + JSON.stringify(doc));
				console.error('Routine definition: ' + this.routine);
				// raise error
				return callback(message);
			}
		}
	}
	return callback(null, doc);
};

/*
 * Creates a transformer instance. 
 *
 * @param: {Callback} callback - invoked with (err, Transformer) parameters
 * @returns: {Object} Transformer - a validated Transformer
 */
var getTransformer = function(callback){

	if(process.env.TRANSFORM_FUNCTION) {
		debug('Trying to load custom transformation routine from file "' + process.env.TRANSFORM_FUNCTION + '".');	
		try {
			var transformFunction = require(require('path').join(process.cwd(),process.env.TRANSFORM_FUNCTION));
			if(typeof transformFunction === 'function') {
				console.log('Transformation routine was loaded from file "' + process.env.TRANSFORM_FUNCTION + '".');
				debug('[-------- transform definition --------]\n' +
					  transformFunction.toString() + '\n' + 
				     '[-----------------------------------------------]');
				return callback(null, new Transformer({id: process.env.TRANSFORM_FUNCTION, routine: transformFunction}));
			}
			else {
				return callback('File "' + process.env.TRANSFORM_FUNCTION + '" does not export a transformation function.');
			}
		}
		catch(err) {
			return callback('Transformation function could not be loaded from file "' + process.env.TRANSFORM_FUNCTION + '": ' + err);
		}
	}
	else {
		console.log('No custom transformation routine was declared. No document transformation will be performed.');
		return callback(null, new Transformer());		
	}
};

// export getter
module.exports.getTransformer = getTransformer;
