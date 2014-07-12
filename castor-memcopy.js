"use strict";

(function() {
  var Q = require('q');
  
  var Get = require('./classes/Get');
  
  var data = {};
  
  /**
   * MemCopy class.
   */
  function MemCopy(query) {
    var self = this;
    
    self.signature = query.signature();
    
    if (typeof data[self.signature] === 'undefined') {
      var defer = Q.defer();
      data[self.signature] = {
        created: Math.round(new Date().getTime() / 1000),
        clients: 1,
        ready: defer.promise,
        rows: [],
        columns: []
      };
      query.then(function(rows) {
        data[self.signature].rows = rows.toArray();
        data[self.signature].columns = rows.getColumns();
        data[self.signature].read = true;
        defer.resolve();
      });
    }
    else {
      ++data[self.signature].clients;
    }
  }
  
  MemCopy.prototype.get = function() {
    var copy = data[this.signature];
    if (typeof copy === 'undefined') {
      throw Error('MemCopy was destroyed');
    }
    var output = new Get(copy);
    return output;
  };
  
  MemCopy.prototype.destroy = function() {
    if (--data[this.signature].clients < 1) {
      delete data[this.signature];
    }
  };
  
  MemCopy.prototype.bury = function(ttl) {
    var self = this;
    var copy = data[this.signature];
    if (typeof copy === 'undefined') {
      throw Error('MemCopy was destroyed');
    }
    --copy.clients;
    if (typeof data[this.signature].ttl === 'undefined') {
      data[this.signature].ttl = ttl;
      setTimeout(function() {
        self.destroy();
      }, ttl * 1000);
    }
  };
  
  module.exports = MemCopy;
  
})(this);
