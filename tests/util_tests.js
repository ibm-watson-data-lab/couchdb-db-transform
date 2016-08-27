const assert = require('assert');

const util = require('../lib/util.js');

var expectedResult = null;

 describe('util', function() {
  describe('#isTrue()', function() {
    it('should return false when the value is not present', function() {
      assert.equal(false, util.isTrue());
    });
  });
  describe('#isTrue(\'\')', function() {
    it('should return false when the value is empty string', function() {
      assert.equal(false, util.isTrue(''));
    });
  });
  describe('#isTrue(0)', function() {
    it('should return false when the value is 0', function() {
      assert.equal(false, util.isTrue(0));
    });
  });
  describe('#isTrue(2)', function() {
    it('should return false when the value is 2', function() {
      assert.equal(false, util.isTrue(2));
    });
  });
  describe('#isTrue(\'  \')', function() {
    it('should return false when the value is a string containing only spaces', function() {
      assert.equal(false, util.isTrue('  '));
    });
  });
  describe('#isTrue(\'somestring\')', function() {
    it('should return false when the value is a string other than \'true\'', function() {
      assert.equal(false, util.isTrue('somestring'));
    });
  });
  describe('#isTrue(0)', function() {
    it('should return false when the value is empty string', function() {
      assert.equal(false, util.isTrue(0));
    });
  });
  describe('#isTrue(1)', function() {
    it('should return ture when the value is 1', function() {
      assert.equal(true, util.isTrue(1));
    });
  });
  describe('#isTrue(true)', function() {
    it('should return true when the value is true', function() {
      assert.equal(true, util.isTrue(true));
    });
  });
  describe('#isTrue(\'true\')', function() {
    it('should return true when the value is \'true\'', function() {
      assert.equal(false, util.isTrue('true'));
    });
  });  
  describe('#isTrue(\'true \')', function() {
    it('should return true when the value is \'true \'', function() {
      assert.equal(false, util.isTrue('true '));
    });
  });  
  describe('#isTrue(\' tRUe \')', function() {
    it('should return true when the value is \' tRUe \'', function() {
      assert.equal(false, util.isTrue(' tRUe '));
    });
  });

  //
  // splitUrl(couchDatabaseURL)
  //

  describe('#splitUrl()', function() {
    it('should return null when the value is not present', function() {
      assert.equal(null, util.splitUrl());
    });
  });
  describe('#splitUrl(\'\')', function() {
    it('should return null when the value is an empty string', function() {
      assert.equal(null, util.splitUrl(''));
    });
  });
  describe('#splitUrl(\'somegarbageinputthatis not a url\')', function() {
    it('should return null when the value is a string that is not a URL', function() {
      assert.equal(null, util.splitUrl('somegarbageinputthatis not a url'));
    });
  });
  describe('#splitUrl(\'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com/\')', function() {
    it('should return null when the URL ends with /', function() {
      assert.equal(null, util.splitUrl('https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com/'));
    });
  });
  describe('#splitUrl(\'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com\')', function() {
    it('should return null when the URL contains only host/domain', function() {
      assert.equal(null, util.splitUrl('https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com'));
    });
  });
  // https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com/source
  describe('#splitUrl(\'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com/source\')', function() {
    it('should return {url:\'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com\', dbname: \'source\'} when the URL is valid', function() {
      assert.equal(JSON.stringify({url:'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com', dbname: 'source'}), JSON.stringify(util.splitUrl('https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com/source')));
    });
  });

  //
  // getCredentialsWithoutPassword
  //
  describe('#getCredentialsWithoutPassword()', function() {
    it('should return null when the value is not present', function() {
      assert.equal(null, util.getCredentialsWithoutPassword());
    });
  });
  describe('#getCredentialsWithoutPassword({})', function() {
    it('should return null when the value is not a valid credentials object', function() {
      assert.equal(null, util.getCredentialsWithoutPassword({}));
    });
  });
  describe('#getCredentialsWithoutPassword({url:\'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com\', dbname: \'source\'})', function() {
    it('should return credentials without password information when the value is a valid credentials object', function() {
      expectedResult = JSON.stringify({url:'https://c6421366-5972-user@c6421366-5972-user-bluemix.cloudant.com/',dbname: 'source'});
      assert.equal(expectedResult, JSON.stringify(util.getCredentialsWithoutPassword({url:'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com', dbname: 'source'})));
    });
  });
  describe('#getCredentialsWithoutPassword({url:\'https://c6421366-5972-user@c6421366-5972-user-bluemix.cloudant.com\', dbname: \'source\'})', function() {
    it('should return credentials without password information when the value is a valid credentials object', function() {
      expectedResult = JSON.stringify({url:'https://c6421366-5972-user@c6421366-5972-user-bluemix.cloudant.com/',dbname: 'source'});
      assert.equal(expectedResult, JSON.stringify(util.getCredentialsWithoutPassword({url:'https://c6421366-5972-user:p0a1s2s3w4o5r6d@c6421366-5972-user-bluemix.cloudant.com', dbname: 'source'})));
    });
  });
});

