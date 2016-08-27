/*
 * Sample transformation function. Adds a "timestamp" property to the document. Value is the current timestamp in ISO 8601 format
 * @param {Object} doc - the source document
 * @returns {Object} - the transformed document
 */
module.exports = function(doc) {

	if(doc) {

		doc.timestamp = new Date().toISOString();

	}
	
	return doc;
};