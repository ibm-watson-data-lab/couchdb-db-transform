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
