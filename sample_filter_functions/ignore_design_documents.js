/*
 * Sample client-side filter function that removes design documents from the processing pipeline.
 * Refer to http://guide.couchdb.org/draft/notifications.html for details about the change parameter
 * @param {Object} change - a document change that was received in the change feed
 * @returns {Boolean} - true if the document is not a design document, false otherwise
 */
module.exports = function(change) {
	if((! change) || (! change.doc) || (change.doc._id.startsWith('_design/'))) {
		return false;
	}
	else {
		return true;
	}
};
