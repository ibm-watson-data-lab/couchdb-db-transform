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

const consts = require('../consts.js');
const debug = require('debug')(consts.appPrefix + ':repository');
const events = require('events');
const util = require('util');
const _ = require('lodash');

const mutil = require('../util.js');

/*
 * Constructor. Initializes the recovery repository database and emits one of the following events:
 * 'error', {String} - error message
 * 'ready', {Object} recoveryRecord
 *          {String} recoveryRecord.last_update_seq - last couchDB update seq that was successfully replicated to the target database
 *          {String} recoveryRecord.last_change_applied - approximate timestamp for above update seq
 * @param {Object} 
 * @param {String} taskId - unique identifier of the task for which recovery records will be saved and loaded by this instance
 *
 */
function CloudantRepository(cloudantRepository,
					  		taskId) {

	events.EventEmitter.call(this);

	this.repositoryDb = null;
	this.taskId = taskId;
	this.state = null;

	if((! cloudantRepository) || (! taskId)) {
		// mandatory parameters are missing (programming error)
		this.state = 'error';
		process.nextTick( function() {
			this.emit('error', 'CloudantRepository: Missing parameters in constructor.');
		}.bind(this));

		return;
	}

	debug('Repository URL: ' + mutil.getUrlWithoutPassword(cloudantRepository.config.url)); 
	debug('Task id: ' + taskId);

	const repository_name = 'transformer_';

	cloudantRepository.db.list(function(err, databases) {
		if(! _.find(databases, 
				  function(database) {
					return (database === repository_name);
				  })) {
			debug('Repository database "' + repository_name + ' does not exist. Creating it.');
			cloudantRepository.db.create(repository_name, function(err) {
				if(err) {
					this.state = 'error';
					this.emit('error', 'Database "' + repository_name + '" could not be created: ' + err);
				}
				else {
					this.repositoryDb = cloudantRepository.db.use(repository_name);

					const ddoc = {
								  _id: '_design/repository',
								  views: {
								    		events: {
								      			map: 'function (doc) {\n  if((doc.record_type) && (doc.record_type === \'event\')) {\n    emit(doc.task_id, [doc.event_type, doc.timestamp]);\n  }\n}'
								    		},
								    		recovery: {
								      			map: 'function (doc) {\n  if((doc.record_type) && (doc.record_type === \'recovery\')) {\n    emit(doc._id, [doc.last_update_seq.split(\'-\')[0],doc.last_change_applied]);\n  }\n}'
								    		}
								  		 },
								  language: 'javascript'
					};

					debug('Repository design doc: ' + JSON.stringify(ddoc));

					this.repositoryDb.insert(ddoc, 
											 function(err) {
												if(err) {
													// treat as non-fatal error
													debug('Could ot create design document in repository database: ' + err);
												}
												this.state = 'ready';
												debug('Repository database was initialized.');
												this.emit('ready', null);
					}.bind(this));

				}
			}.bind(this));
		}
		else {
			this.repositoryDb = cloudantRepository.db.use(repository_name);
			this.state = 'ready';
			debug('Repository database is ready. Loading recovery info.');
			this.loadRecoveryInfo(function(err, recoveryInfo) {
				if(err) {
					debug(err);
				}
				this.emit('ready', recoveryInfo);
			}.bind(this));
		}
	}.bind(this));
	
} // constructor

// inherit event emitting capabilities
util.inherits(CloudantRepository, events.EventEmitter);

/*
 * Loads recovery information from the recovery log file.
 * @returns {Callback} callback - callback(err, recoveryRecord)
 * @returns {String} err - error message
 * @returns {Object} recoveryRecord
 * @returns {String} recoveryRecord.last_update_seq - last couchDB update seq that was successfully replicated to the target database
 * @returns {String} recoveryRecord.last_change_applied - approximate timestamp for above update seq
 */
CloudantRepository.prototype.loadRecoveryInfo = function(callback) {

	if((! callback) || (typeof callback !== 'function')) {
		callback = function(err) {
			if(err) {
				console.error('Callback in loadRecoveryInfo is missing. Using default to display error: ' + err);
			}
		};
	}
	
	if((! this.state) || (this.state === 'error')) {
		return callback('The repository database is not ready.');
	}

	this.repositoryDb.get(this.taskId, 
						  function(err, body) {

						  	if(err) {
						  		if(err.statusCode === 404) {
						  			// no recovery record exists (not an error)
						  			return callback();	
						  		}
						  		return callback('Error loading recovery record: ' + JSON.stringify(err));
						  	}
						  	return callback(null, { last_update_seq: body.last_update_seq, last_change_applied: body.last_change_applied });
						  });
};

/*
 * Upserts recovery information in the repository. (There's only one recovery record per task)
 * @param {String} last_update_seq - last couchDB update seq that was successfully replicated to the target database
 * @param {String} last_change_applied - approximate timestamp for above update seq
 * @returns {Callback} callback - callback(err)
 * @returns {String} err - error message
 */
CloudantRepository.prototype.saveRecoveryInfo = function(last_update_seq,
												   		 last_change_applied,
												   		 callback) {

	if((! callback) || (typeof callback !== 'function')) {
		callback = function(err) {
			if(err) {
				console.error('Callback in saveRecoveryInfo is missing. Using default to display error: ' + err);
			}
		};
	}

	if((! this.state) || (this.state === 'error')) {
		return callback('The repository database is not ready.');
	}

	this.repositoryDb.get(this.taskId, 
						  function(err, body) {

		var recoveryRecord = {
								_id: this.taskId,
								task_id: this.taskId,
								record_type: 'recovery',
								last_update_seq: last_update_seq,
								last_change_applied: last_change_applied
					   		   };
		if(err) {
			if(err.statusCode === 404) {
				this.repositoryDb.insert(recoveryRecord, function(err) {
					if(err) {
						return callback('Recovery record could not be inserted: ' + JSON.stringify(err));
					}
					else {
						return callback();
					}
				});							
			}
			else {
				return callback('Recovery record could not be read: ' + JSON.stringify(err));
			}
		}
		else {
			recoveryRecord._rev = body._rev;
			this.repositoryDb.insert(recoveryRecord, function(err) {
				if(err) {
					return callback('Recovery record could not be updated: ' + JSON.stringify(err));
				}
				return callback();
			});			
		}
	}.bind(this));

};

/*
 * Saves event information in the repository.
 * @param {String} event - name of the event  
 * @param {String} data - data associated with the event
 * @returns {Callback} callback - callback(err)
 * @returns {String} err - error message
 */
CloudantRepository.prototype.saveEvent = function(event_type,
												  data,
												  callback) {

	if((! callback) || (typeof callback !== 'function')) {
		callback = function(err) {
			if(err) {
				console.error('Callback in saveEvent is missing. Using default to display error: ' + err);
			}
		};
	}

	if((! this.state) || (this.state === 'error')) {
		return callback('The repository database is not ready.');
	}

	var eventRecord = {
						task_id: this.taskId,
						record_type: 'event',
						event_type: event_type,
						data: data,
						timestamp: new Date().toISOString()
					  };

	debug('Saving source feed event: ' + JSON.stringify(eventRecord));				  

	this.repositoryDb.insert(eventRecord, function(err) {
		if(err) {
			return callback('Event record could not be saved: ' + JSON.stringify(err));
		}
		else {
			return callback();
		}
	});							

};

// export constructor
module.exports.CloudantRepository = CloudantRepository;
