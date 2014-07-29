"use strict";

(function() {
  
  /**
   * Rows class
   */
  var Rows = function(rows, columns) {
    this._current = 0;
    this.columns = columns;
    this.rows = rows;
  };
  
  Rows.prototype.getColumns = function() {
    return this.columns;
  };
  
  Rows.prototype.count = function() {
    return this.rows.length;
  };
  
  Rows.prototype.current = function() {
    if (typeof this.rows[this._current] === 'undefined') {
      throw Error('Invalid position');
    }
    return this.rows[this._current];
  };
  
  Rows.prototype.key = function() {
    return this._current;
  };
  
  Rows.prototype.next = function() {
    ++this._current;
  };
  
  Rows.prototype.rewind = function() {
    this._current = 0;
  };
  
  Rows.prototype.valid = function() {
    return typeof this.rows[this._current] !== 'undefined';
  };
  
  Rows.prototype.toArray = function() {
    return this.rows;
  };
  
  Rows.prototype.getColumn = function(name) {
    var items = [];
    this._current = 0;
    
    while (this._current < this.rows.length) {
      var row = this.current();
      items.push(row[name]);
      ++this._current;
    }
    return items;
  };
  
  Rows.prototype.addColumn = function(columnSpec, values) {
    this.columns.push(columnSpec);
    for (var i = 0; i < values.length; ++i) {
      this.rows[i].push(values[i]);
    }
  };
  
  module.exports = Rows;
}).call(this);
