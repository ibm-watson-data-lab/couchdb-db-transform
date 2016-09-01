/*jshint unused:false*/

/*
 * Sample STAGE_2 filter function that removes deleted documents from the processing pipeline.
 * Refer to http://guide.couchdb.org/draft/notifications.html#filters for details
 * @param {Object} change - the change 
 * @returns {Boolean} - true if the document should be processed, false if it should be ignored
 */
module.exports = function(change) {

	if(change.deleted) {
		return false;
	}
	else {
		return true;
	}

};