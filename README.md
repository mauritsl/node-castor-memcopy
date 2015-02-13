node-castor-memcopy
==================

Memcopy is an in-memory caching and processing extension for [Castor][castor].
It allows fast query processing and more flexibility than regular Cassandra
CQL queries. This module is designed for small datasets (< 10k rows).

Key features:

- Caching of (partial) tables
- Query data using chainable functions
- Fulltext search
- Usage is very similar to Castor Client, making it easy to build-in MemCopy
  in existing projects already using Castor.

[castor]: https://github.com/kriskowal/q/wiki/API-Reference

## Installation

Install using ``npm install castor-memcopy`` and ``npm install castor-client``.

## Usage

```javascript
var Castor = require('castor-client');
var MemCopy = require('castor-memcopy');

var db = new Castor('localhost', 'keyspace');
var query = db.get('user').fields(['user_id', 'name', 'logins', 'bio']);

var copy = new MemCopy(query);
copy.get()
  .filter('name', /[0-9]/)
  .filter('logins', 1234, '>')
  .search('name', 'john')
  .orderBy('search_score', 'desc')
.then(function(rows) {
  console.log(rows.toArray());
  copy.bury(60);
});
```

When using MemCopy, you do not execute the Castor Client query itself. Instead,
you make a copy using ``new MemCopy(query)`` and from there on use the copy.
MemCopy will start loading all data from Cassandra directly after calling
the constructor. All queries on the copy will not involve the database at all.
When ready, you should always call ``destroy`` or ``bury``. The ``destroy``
function will destroy the memory copy (after all clients are ready using it).
This function does not take any arguments. The ``bury`` function will keep the
copy in memory for the given number of seconds. If another MemCopy is created
with the exact same query within this time, it will not load the data again from
the database.

## Retreiving data

Data is retreived using the ``get`` function. This function takes no arguments,
in contract to the regular ``Castor.get``. All filtering function can be
chained to this function. The query is executed by calling ``then`` or
``execute``. MemCopy provides the same set of functions on the resultset as
Castor does. Both examples below are identical.

```javascript
// Using Castor Client.

db.get('user')
  .filter('user_id', '...')
.then(function(rows) {
  while (rows.valid()) {
    var row = rows.current();
    rows.next();
  }
});
```

```javascript
// Using Castor MemCopy.

var copy = new MemCopy(db.get('user'));
copy.get()
  .filter('user_id', '...')
.then(function(rows) {
  while (rows.valid()) {
    var row = rows.current();
    rows.next();
  }
  copy.bury(60);
});
```

Note that the MemCopy example will load the whole table from the database,
since no filtering is specified in the query provided to ``new MemCopy()``.
The MemCopy example however, will not use the database in the next 60 seconds,
no matter how many queries are executed.

## Filtering

The code belows shows all filtering options.

```javascript
var copy = new MemCopy(db.get('user'));
var query = copy.get();

// Simple filtering.
query.filter('user_id', '...');
query.filter('user_id', '...', '==='); // Default
query.filter('user_id', '...', '==');
query.filter('user_id', '...', '!==');
query.filter('user_id', '...', '!=');
query.filter('user_id', '...', '<');
query.filter('user_id', '...', '>');
query.filter('user_id', '...', '<=');
query.filter('user_id', '...', '>=');

// Regular expression matching.
query.filter('name', /[0-9]/); // Only names containing numbers.
query.filter('name', /[0-9]/, '!='); // No names containing numbers.

// Full text searching.
query.search('bio', 'friendly nice generous');
query.search(['interests', 'work'], 'hardworking teamplayer');
// Search function will add the column "search_score". Sort by relevance.
query.orderBy('search_score', 'desc');

// Ordering.
query.orderBy('name', 'asc');
query.orderBy('logins', 'desc');

// Limit results to top 10.
query.limit(10);

// Limit results with offset (result 10 to 15).
query.range(10, 5);

query.then(function(rows) {
  console.log('Found ' + rows.count() + ' rows');
  copy.destroy();
});
```

## Clear cache

Use the ``clearCache`` function to clear all caches.

```javascript
MemCopy.clearCache();
```
