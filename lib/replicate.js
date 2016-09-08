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
const crypto = require('crypto');
const consts = require('./consts');
const debug = require('debug')(consts.appPrefix + ':replicate');
const debug_data = require('debug')(consts.appPrefix + ':data');
const debug_perf = require('debug')(consts.appPrefix + ':performance');

const mutil = require('./util.js');
const r_cloudant = require('./util/cloudantRepository.js');

/*
 * Replication function. Listens to the change feed of the database identified by <sourceCredentials>, 
 * and selectively applies those changes to the database identified by <targetCredentials>.
 * 
 * @param {Object} sourceCredentials - credentials for the source database
 * @param {String} sourceCredentials.url - the URL of the source database
 * @param {String} sourceCredentials.dbname - the name of the source database
 * @param {Object} targetCredentials - credentials for the target database
 * @param {String} targetCredentials.url - the URL of the target database
 * @param {String} targetCredentials.dbname - the name of the target database
 * @param {Boolean} restart - if true (false is default), process all document changes in the source database; if false process changes that were not yet processed
 */
function Replicator(sourceCredentials, 
					targetCredentials,
					restart) {

	this.sourceCredentials = sourceCredentials;
	this.targetCredentials = targetCredentials;
	// set the default (true = process all document changes, 
	//		            false = process document changes that were not yet processed)	
	this.restart = restart || false;

	// service status information
	this.stats = {
					initialized: false,			// service status
					source: {
								//database_name: null,					// source database name
								//last_change_received: null,	// timestamp for last change notification that was received from the source database
								//update_seq: null				// most current seq number
					},
					target: {
								//database_name: null,					// target database name
								//last_change_applied: null,	// timestamp for last write operation in the target database
								//last_applied_update_seq: 0,	// CouchDB update_seq number for the last change that was written to the target database
								//copied: 0,					// document copy successes
								//failed: 0,					// document copy failures
					},
					filter: {
						server: null,	// server-side filter info
						client: null	// client-side filter info
					},
					transformer: null	// transformer info
				};


	this.sourceCloudant = null;			

} // constructor

/*
 * Initializes the replication function. (Checks database connectivity etc)
 * @param {callback} initCallback(err)
 */
Replicator.prototype.init = function(initCallback) {

	if((! this.sourceCredentials) || (! this.sourceCredentials.url) || (! this.sourceCredentials.dbname)) {
		return initCallback('Source database information is missing or incomplete. Expected input format https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME');
	}

	if((! this.targetCredentials) || (! this.targetCredentials.url) || (! this.targetCredentials.dbname)) {
		return initCallback('Target database information is missing or incomplete. Expected input format https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME');
	}

	// connect to source system	
	this.sourceCloudant = require('cloudant')({url:this.sourceCredentials.url});

	// verify that the source database exists
	this.sourceCloudant.db.get(this.sourceCredentials.dbname, function(err, body) {

		if(err) {
			return initCallback('The source database "' + this.sourceCredentials.dbname + '" cannot be accessed: ' + err);
		}

		debug('Source database information: ' + JSON.stringify(body));

		this.stats.source = {
								database_name : this.sourceCredentials.dbname
							};

		const sourceDb = this.sourceCloudant.db.use(this.sourceCredentials.dbname);

		// connect to target system
		const targetCloudant = require('cloudant')({url:this.targetCredentials.url});

		// verify that the target database exists
		targetCloudant.db.get(this.targetCredentials.dbname, function(err, body) {

			if(err) {
				return initCallback('The target database "' + this.targetCredentials.dbname + '" cannot be accessed: ' + err);
			}

			debug('Target database information: ' + JSON.stringify(body));

			this.stats.target = {
									database_name: this.targetCredentials.dbname,
									last_applied_update_seq: 0,
									copied: 0,
									failed: 0 
								};

			const targetDb = targetCloudant.db.use(this.targetCredentials.dbname);

			const concurrency = 1; // maximum number of workers that will insert batches of documents in the target database

			var that = this;

			// for now only Cloudant is supported as repository
			var rr = new r_cloudant.CloudantRepository(targetCloudant, 
													   crypto.createHash('md5').update(JSON.stringify(this.sourceCredentials) + ' ' + JSON.stringify(this.targetCredentials)).digest('hex'));

			// bulk insert documents into the target database
			var q = async.queue(function(batch, callback) {

				debug('Saving new batch of documents. Batch size is ' + batch.changes.length);

				var seq = [];
				var docs = [];
				batch.changes.forEach(function(change) {
					seq.push(change.seq);	
					docs.push(change.doc);
				});		

				targetDb.bulk({docs:docs}, 
							  function(err, data) {
								if(err) {

									// an error was returned; assume that none of the documents was successfully stored
									this.stats.target.failed = this.stats.target.failed + batch.changes.length;

									// save error information for troubleshooting purposes
									rr.saveErrorEvent('target-bulk-write-error',
													  'target database',
													  {	
													 	error: err	
													  },
											          function(err) {
											          	if(err) {
											         		console.error('"target-bulk-write-error" event data could not be saved in the repository: ' + err);
											         	}
											         	console.log('"target-bulk-write-error" event data was saved in the repository.');
											          });

									return callback('Error saving documents in target database "' + 
													this.targetCredentials.dbname + '": ' + err);
								}
								else {

									// keep track of when the last change was written to the target database
									this.stats.target.last_change_applied = Date();

									var lastSuccessSeqInBatch = null;
									var errors = [];

									data.forEach(function (result, index) {
										
													if(result.id && result.rev) {
														this.stats.target.copied++;
														lastSuccessSeqInBatch = seq[index];
													}
													else {
														errors.push(result);
														this.stats.target.failed++;
													}
												},
												this);

									if(errors.length > 0) {

										// save error information for troubleshooting purposes
										rr.saveErrorEvent('target-bulk-write-error',
														  'target database',
														  {
														  	results: data	
														  },
												          function(err) {
												         	if(err) {
												         		console.error('"target-bulk-write-error" event data could not be saved in the repository: ' + err);
												         	}
												         	console.log('"target-bulk-write-error" event data was saved in the repository.');
												          });

										return callback('Error saving documents in target database "' + 
														this.targetCredentials.dbname + '": ' + JSON.stringify(errors));
									}

									this.stats.target.last_applied_update_seq = lastSuccessSeqInBatch;

									// write recovery info
									rr.saveRecoveryInfo(this.stats.target.last_applied_update_seq,
														this.stats.target.last_change_applied,
														function(err) {
															return callback(err);		
														});
								}
							  }.bind(this));

			}.bind(this), concurrency);

			// repository is not available
			rr.on('error', function(message) {
				return initCallback('Error. The repository is not available: ' + message);		
			});

			// repository is ready
			rr.on('ready', function(recoveryInfo) {

				// load transformation routine, if configured
				require('./transform.js').getTransformer(function(err, transformer) {
					if(err) {
						return initCallback(err);
					}

					this.stats.transformer = {
												name : transformer.getName(),
												definition : transformer.getRoutineDefinition()
											};

					// load filters, if configured
					require('./filter.js').getFilter(sourceDb, 
													 function(err, filter) {
						if(err) {
							return initCallback(err);
						}

						this.stats.filter.server = {
													name : filter.getServerFilterName(),
													definition : filter.getServerFilterDefinition()
												   };
						this.stats.filter.client = {
													name : filter.getClientFilterName(),
													definition : filter.getClientFilterDefinition(),
													filtered : 0
												   };

						console.log('Replicator ready. Starting to listen for changes in database "' + 
									this.sourceCredentials.dbname + '". Changes will be applied to database "' + 
									this.targetCredentials.dbname + '".');

						debug(JSON.stringify({source: mutil.getCredentialsWithoutPassword(this.sourceCredentials),
							           		  target: mutil.getCredentialsWithoutPassword(this.targetCredentials)}));

						// save configuration information (informational purposes only)
						rr.saveInfoEvent('start',
										 'application',
										 {source: mutil.getCredentialsWithoutPassword(this.sourceCredentials), 
										  target: mutil.getCredentialsWithoutPassword(this.targetCredentials),
										  filter: {
										  	server: {
										  		'name' : filter.getServerFilterName(), 
										  		'definition': filter.getServerFilterDefinition()
										  	}, 
										  	client: {
										  		'name' : filter.getClientFilterName(), 
										  		'definition': filter.getClientFilterDefinition()
										  	}
										  },
										  transformer: {
										  		'name': transformer.getName(),
										  		'definition': transformer.getRoutineDefinition()	
										  }		  
										 },
								         function(err) {
								         	if(err) {
								         		console.error('Configuration information could not be saved in repository: ' + err);
								         	}
								         	console.log('Service configuration was recorded in the repository.');
								         });

						var changes = [];
						const changes_per_batch = 500;

						if((! this.restart) && (recoveryInfo)) {
							// a recovery record was found; continue processing changes in the source database
							// that were recorded after this recovery record was written
							this.stats.target.last_applied_update_seq = recoveryInfo.last_update_seq;
							this.stats.target.last_change_applied = recoveryInfo.last_change_applied;

							console.log('Loaded recovery information. Resuming change tracking in source database starting with sequence number "' + 
										recoveryInfo.last_update_seq + '"" dated ' + recoveryInfo.last_change_applied + '.');
						}

						const update_start_sequence = this.stats.target.last_applied_update_seq;

						var feedOptions = {
											since: update_start_sequence,
											include_docs: true
										  };

						if(filter.hasServerFilter()) {
							feedOptions.filter = filter.getServerFilterName();	
						}					

					    // create a change feed for the source database; capture either all document changes (couch_start_seq = 0)
						// or all changes that occurred after couch_start_seq
						var feed = sourceDb.follow(feedOptions);

						// The follow implementation does not support filtering on the server and 
						// locally.If we were to do the following the STAGE_1 filter would be ignored:
						// if(DocumentFilter.isStage2FilterDefined()) {
						//	feed.filter = DocumentFilter.getStage2Filter();
						// }
						// We are therefore performing our own filtering for each incoming change

						// process document changes
						feed.on('change', function (change) {

							if(filter.applyClientFilter(change)) {

								// status monitoring: keep track of when the last change notification was received
								that.stats.source.last_change_received = Date();

								debug_data(change);

								// updates are currently not supported; remove _rev from document;
								// note that this might cause document update conflicts
								delete change.doc._rev;

								// invoke transformation routine
								transformer.transform(change.doc,
													  function(err, transformedDoc) {
													  	if(err) {
													  		return initCallback(err);
													  	}
													  	// add change to batch
														changes.push({seq:change.seq, 
														 		      doc: transformedDoc});		  	
														if(changes.length >= changes_per_batch) {
															q.push({changes:changes.splice(0, changes_per_batch)}, 
																   function(err) {
																	if(err)	{
																		console.error('Worker returned an error: ' + err);
														 			}
																	console.log('Status summary: ' + JSON.stringify(that.getStatus()));
																   });			  	
														}
													  }.bind(that));
							}
							else {
								that.stats.filter.client.filtered++;
								debug('Ignored change in document ' + change.doc._id + '.');
								debug(JSON.stringify(change.doc));
							}
						});

						// an error occurred while listening to the change feed
						feed.on('error', function (error) {
								rr.saveErrorEvent('source_feed_error',
												  'source feed',
											 	  JSON.stringify(error));
							  	console.error('Source feed error: ' + error);
							   });

						// TBD
						feed.on('inactive', function (message) {
								rr.saveWarningEvent('source_feed_inactive',
											 		'source feed',									
											  		message);
							  	console.log('Inactive: ' + message);
							  	console.log('Pending: '+ changes.length);
							   });

						// a timeout occurred while listening to the change feed
						feed.on('timeout', function (info) {
								rr.saveErrorEvent('source_feed_timeout',
											 	  'source feed',									
											 	  info);
							   });

						// an error occurred while listening to the change feed
						feed.on('retry', function (info) {
								rr.saveInfoEvent('source_feed_retry',
												 'source feed',									
											 	 info);
							   });

						// change feed is stopping (because of an error or stop())
						feed.on('stop', function () {
								rr.saveInfoEvent('source_feed_stopped',
											 	 'source feed',									
											 	 null);
							  	console.error('Source feed stopped.');
							   });

						// Throttle change feed to limit memory consumption; check queue size every 
						// <check_queue_size_interval> ms and pause if more than <max_queued_batches> 
						// are waiting to be processed
						const max_queued_batches = 50;
						const check_queue_size_interval = 10000;
						var feed_paused = false;
						setInterval(function() {
						  
						  if(q.length() > max_queued_batches) {
						  	if(! feed_paused) {
						  		feed.pause();
						  		feed_paused = true;
						  		debug_perf('Pausing change feed to reduce memory consumption. Queue size: ' + q.length());
						  		debug_perf('Memory utilization: ' + JSON.stringify(process.memoryUsage()));
						  	}
						  }
						  else {
						  	if(feed_paused) {
							  	feed.resume();
							  	feed_paused = false;
							  	debug_perf('Resuming change feed. Queue size: ' + q.length());
						  	}
						  }
						}, check_queue_size_interval);

						// follow the change feed
						feed.follow();

						/*
						 * Monitor replication status every <X> ms. If no change activity was reported by the source 
						 * flush the document buffer. X is calculated as follows:
						 *  <inactivity_check_interval> * (Math.pow(2,<inactivity_check_interval_delay_factor>))
						 *  <inactivity_check_interval_delay_factor> is increased if the system is found idle 
						 */
						const inactivity_check_interval = 60 * 1000,			// base check interval is 60 seconds
							  max_inactivity_check_interval_delay_factor = 6;	// 60 seconds * 2^6 = 64 minutes (maximum interval)
						var   inactivity_check_interval_delay_factor = 0;		// 60 seconds * 2^1 = 60 seconds (minimum interval)		  

						var flush_timer = null;

						var flush = function() {
							if(changes.length === 0) {
								if(q.idle()) {
									if(inactivity_check_interval_delay_factor <= max_inactivity_check_interval_delay_factor) {
										inactivity_check_interval_delay_factor++;
										clearInterval(flush_timer);	
										flush_timer = setInterval(flush.bind(this),
						 						                  inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)));
									}
								}
								console.log(Date() + ' Document buffer is empty. Next attempt to flush buffer will be made in ' + (inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)) / 1000) + ' seconds.');
							}
							else {
								if(q.idle()) {
									// there's at least one document in the buffer that has not been sent to the target
									// write the buffer content to the target
									console.log('Flushing buffer containing ' + changes.length + ' documents.');
									q.push({changes:changes.splice(0, changes_per_batch)}, 
										   function(err) {
												if(err)	{
								  					console.error('Worker returned an error: ' + err);
									  			}

												console.log('Status summary: ' + JSON.stringify(that.getStatus()));
											}.bind(this));
								}
								inactivity_check_interval_delay_factor = 0;	
								clearInterval(flush_timer);	
								flush_timer = setInterval(flush.bind(this),
						 				                  inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)));
							}
						};

						// interval timer: flush partially filled document buffer if the change feed is idle
						flush_timer = setInterval(flush.bind(this),
						 						  inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)));


						this.stats.initialized = true;

						// signal to the caller that initialization has completed
						return initCallback();

					}.bind(this));	// require('./filter.js')...
				}.bind(this)); 		// require('./transform.js')...
			}.bind(this)); 			// rr.on('ready',...
		}.bind(this)); 				// targetCloudant.db.get(this.targetCredentials.dbname,...
	}.bind(this)); 					// this.sourceCloudant.db.get(this.sourceCredentials.dbname,...
};

/*
 * Returns detailed system status information
 * @return {Object} status
 * @return {Numeric} status.copied - documents copied
 * @return {Numeric} status.failed - document copy failures
 * @return {Numeric} status.filtered - documents that were not copied because the filter condition was met
 * @return {String} status.last_change_received - timestamp for last change notification that was received from the source database
 * @return {String} status.last_change_applied - timestamp for last write operation in the target database
 * @return {String} status.last_update_seq - CouchDB update_seq number for the last change that was written to the target database
 * @return {Object}	status.filter - filter information
 * @return {Object}	status.filter.server - server-side filter information
 * @return {String}	status.filter.server.name - if defined, <design_doc/filter> containing the filter routine
 * @return {String}	status.filter.server.definition - the routine text of status.filter.server.name
 * @return {Object}	status.filter.client - client-side filter information
 * @return {String}	status.filter.client.name if - defined, <design_doc/filter> containing the filter routine
 * @return {String}	status.filter.client.definition - the routine text of status.filter.client.name
 * @return {Object}	status.transformer - transformer information
 * @return {String}	status.filter.transformer.name - if defined, the file name containing the transformation routine 
 * @return {String}	status.filter.transformer.definition - the routine text of status.filter.transformer.name 
 */
Replicator.prototype.getDetailedStatus = function(callback) {

	var status = {
					status_date: Date(),
					service_status: {
										source: {
													database_name: this.stats.source.database_name,
													last_change_received: this.stats.source.last_change_received
											    },
										target: this.stats.target,
										filter: this.stats.filter,
										transformer: this.stats.transformer
									}
				 };

	if(this.sourceCloudant) {
		debug('Getting metadata for source database ' + this.sourceCredentials.dbname);
		this.sourceCloudant.db.get(this.sourceCredentials.dbname, function(err, body) {
			if(err) {
				console.error('The source database "' + this.sourceCredentials.dbname + '" cannot be accessed: ' + err);
				status.service_status.source.update_seq = '<Not available>';	
			}
			else {
				status.service_status.source.update_seq = body.update_seq;
			}
			return callback(null, status);	
		}.bind(this));
	}
	else {
		return callback(null, status);	
	}
	
};

/*
 * Returns system status information
 * @return {Object} status
 * @return {Object} status.source
 * @return {String} status.source.database_name - source database name
 * @return {String} status.source.last_change_received - timestamp for last change notification that was received from the source database
 * @return {Object} status.target
 * @return {String} status.target.database_name - target database name
 * @return {String} status.target.last_applied_update_seq - CouchDB update_seq number for the last change that was written to the target database 
 * @return {Numeric} status.target.copied - documents copied
 * @return {Numeric} status.target.failed - document copy failures
 * @return {String} status.target.last_change_applied - timestamp for last write operation in the target database
 * @return {Numeric} status.filtered - documents that were not copied because the filter condition was met
 */
Replicator.prototype.getStatus = function() {

	if(this.stats.filter.client) {
		return {
				source: this.stats.source,
				target: this.stats.target,
				filtered: this.stats.filter.client.filtered
		   };	
	}

	return {
				source: this.stats.source,
				target: this.stats.target
		   };	
};

module.exports = Replicator;
